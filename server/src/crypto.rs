//! Cryptographie par WebCrypto (design D3) : calculée par la plateforme, hors du WASM.
use std::cell::RefCell;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use worker::Result;

fn crypto() -> Result<web_sys::Crypto> {
    Ok(js_sys::Reflect::get(&js_sys::global(), &"crypto".into())?.unchecked_into())
}

pub fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// `n` octets aléatoires en hexadécimal.
pub fn rid(n: usize) -> Result<String> {
    let mut b = vec![0u8; n];
    crypto()?.get_random_values_with_u8_array(&mut b)?;
    Ok(hex(&b))
}

pub async fn sha(s: &str) -> Result<String> {
    let d = JsFuture::from(crypto()?.subtle().digest_with_str_and_u8_array("SHA-256", s.as_bytes())?).await?;
    Ok(hex(&js_sys::Uint8Array::new(&d).to_vec()))
}

/// `sel$empreinte` : PBKDF2-HMAC-SHA-256, 100 000 tours, 256 bits ; le sel est utilisé tel quel (octets UTF-8).
pub async fn hash_pw(pw: &str, salt: Option<&str>) -> Result<String> {
    let salt = match salt {
        Some(s) => s.to_string(),
        None => rid(16)?,
    };
    let s = crypto()?.subtle();
    let usages = js_sys::Array::of1(&"deriveBits".into());
    let key = JsFuture::from(s.import_key_with_str("raw", &js_sys::Uint8Array::from(pw.as_bytes()), "PBKDF2", false, &usages)?).await?;
    let algo = js_sys::Object::new();
    js_sys::Reflect::set(&algo, &"name".into(), &"PBKDF2".into())?;
    js_sys::Reflect::set(&algo, &"hash".into(), &"SHA-256".into())?;
    js_sys::Reflect::set(&algo, &"salt".into(), &js_sys::Uint8Array::from(salt.as_bytes()))?;
    js_sys::Reflect::set(&algo, &"iterations".into(), &JsValue::from(100_000))?;
    let bits = JsFuture::from(s.derive_bits_with_object(&algo, &key.unchecked_into(), 256)?).await?;
    Ok(salt + "$" + &hex(&js_sys::Uint8Array::new(&bits).to_vec()))
}

/// Comparaison en temps constant.
pub fn same(a: &str, b: &str) -> bool {
    let (a, b): (Vec<u16>, Vec<u16>) = (a.encode_utf16().collect(), b.encode_utf16().collect());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(&b).fold(0u16, |d, (x, y)| d | (x ^ y)) == 0
}

thread_local! {
    static DUMMY: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Une empreinte factice : une adresse inconnue coûte autant de calcul qu'un mauvais mot de passe.
pub async fn dummy() -> Result<String> {
    if let Some(d) = DUMMY.with(|d| d.borrow().clone()) {
        return Ok(d);
    }
    let d = hash_pw(&"x".repeat(12), None).await?;
    DUMMY.with(|c| *c.borrow_mut() = Some(d.clone()));
    Ok(d)
}

#[cfg(test)]
mod tests {
    /// même algorithme que le serveur JavaScript : empreinte calculée par Node (crypto.pbkdf2Sync)
    #[test]
    fn empreinte_compatible() {
        let salt = "a".repeat(32);
        let mut out = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<sha2::Sha256>(b"motdepasse1", salt.as_bytes(), 100_000, &mut out);
        assert_eq!(super::hex(&out), "1876a68df37a5f5008cae674a0c83bfc6b4ef5aef0af49fd575032cc3e1c45af");
        assert!(super::same("abc", "abc") && !super::same("abc", "abd") && !super::same("abc", "ab"));
    }
}
