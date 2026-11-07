//! Les expressions régulières du serveur JavaScript, écrites à la main (design D6 : pas de crate `regex`).
use crate::js;

fn name_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-')
}

/// `^[A-Za-z0-9_.-]{1,max}$`
fn token(s: &str, max: usize) -> bool {
    !s.is_empty() && s.len() <= max && s.chars().all(name_char)
}

/// Nom de fichier en transit (KEY_RE).
pub fn key(s: &str) -> bool {
    token(s, 128)
}

/// Identifiant de projet, de compte ou d'appareil (PID_RE).
pub fn pid(s: &str) -> bool {
    token(s, 64)
}

fn email_char(c: char) -> bool {
    !(js::is_space(c) || matches!(c, '@' | '<' | '>' | '"' | '\'' | '`'))
}

/// `^[^\s@<>"'`]{1,64}@[^\s@<>"'`]{1,190}\.[^\s@<>"'`]{2,}$` (longueurs en unités UTF-16, comme en JavaScript)
pub fn email(s: &str) -> bool {
    let Some((local, rest)) = s.split_once('@') else { return false };
    let ll = js::len(local);
    if !(1..=64).contains(&ll) || !local.chars().all(email_char) || !rest.chars().all(email_char) {
        return false;
    }
    // un point tel qu'il y ait de 1 à 190 unités avant et au moins 2 après
    let units: Vec<u16> = rest.encode_utf16().collect();
    let n = units.len();
    units.iter().enumerate().any(|(i, &u)| u == b'.' as u16 && (1..=190).contains(&i) && n - i > 2)
}

/// Types de fichiers servis tels quels (BLOB_TYPES).
pub fn blob_type(ct: &str) -> bool {
    if let Some(t) = ct.strip_prefix("image/") {
        return matches!(t, "jpeg" | "png" | "webp" | "avif" | "gif" | "heic" | "heif" | "tiff" | "jxl")
            || t.strip_prefix("x-").is_some_and(|x| !x.is_empty() && x.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'+' | b'-')));
    }
    matches!(ct, "application/json" | "application/octet-stream" | "video/mp4" | "video/quicktime")
}

/// Photo de profil : `^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$`
pub fn avatar(s: &str) -> bool {
    let Some(rest) = ["jpeg", "png", "webp"].iter().find_map(|t| s.strip_prefix(&format!("data:image/{t};base64,"))) else { return false };
    let data = rest.trim_end_matches('=');
    let pad = rest.len() - data.len();
    pad <= 2 && !data.is_empty() && data.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
}

/// Nom d'appareil ou plateforme : `[\u0000-\u001f\u007f<>"'`]` retirés, espaces aux extrémités retirés.
pub fn clean_device(s: &str) -> String {
    let t: String = s.chars().filter(|&c| !(c <= '\u{1f}' || c == '\u{7f}' || matches!(c, '<' | '>' | '"' | '\'' | '`'))).collect();
    js::trim(&t).to_string()
}

/// Nom affiché du profil : `[\u0000-\u001f\u007f<>]` retirés, espaces aux extrémités retirés.
pub fn clean_name(s: &str) -> String {
    let t: String = s.chars().filter(|&c| !(c <= '\u{1f}' || c == '\u{7f}' || matches!(c, '<' | '>'))).collect();
    js::trim(&t).to_string()
}

/// Type d'un dépôt : `String(h || '').split(';')[0].trim().toLowerCase()`
pub fn content_type(h: Option<String>) -> String {
    let h = h.unwrap_or_default();
    js::trim(h.split(';').next().unwrap_or("")).to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noms() {
        assert!(key("tile_1.jpg") && key(&"a".repeat(128)) && !key(&"a".repeat(129)));
        assert!(!key("") && !key("a/b") && !key("a b") && !key("é"));
        assert!(pid(&"a".repeat(64)) && !pid(&"a".repeat(65)));
    }

    #[test]
    fn adresses() {
        for ok in ["draco@example.com", "a@b.cd", "x.y+z@sous.domaine.fr", "a@b.c.de", "é@exemple.fr"] {
            assert!(email(ok), "{ok}");
        }
        for ko in ["", "a@b.c", "@b.cd", "a@.cd", "a b@c.de", "<b>@example.com", "a@b@c.de", "a@bcd", "a\"@b.cd", "a@b.cd\u{a0}", &format!("{}@b.cd", "a".repeat(65)), &format!("a@{}.cd", "b".repeat(191))] {
            assert!(!email(ko), "{ko}");
        }
        assert!(email(&format!("{}@{}.cd", "a".repeat(64), "b".repeat(190))));
        // le point peut être n'importe où tant qu'il y en a un bien placé
        assert!(email("a@b.c.d"));
    }

    #[test]
    fn types() {
        for ok in ["image/jpeg", "image/x-canon-cr2", "image/x-a.b+c", "application/json", "video/quicktime"] {
            assert!(blob_type(ok), "{ok}");
        }
        for ko in ["text/html", "image/svg+xml", "image/x-", "image/X-ABC", "image/jpeg2", "application/javascript", ""] {
            assert!(!blob_type(ko), "{ko}");
        }
        assert_eq!(content_type(Some(" Image/JPEG ; q=1".into())), "image/jpeg");
    }

    #[test]
    fn avatars() {
        assert!(avatar("data:image/png;base64,iVBORw0KGgo="));
        assert!(avatar("data:image/webp;base64,AAAA=="));
        assert!(!avatar("data:image/png;base64,AAA==="));
        assert!(!avatar("data:image/png;base64,"));
        assert!(!avatar("data:image/svg+xml;base64,PHN2Zz4="));
        assert!(!avatar("data:image/png;base64,AA AA"));
    }

    #[test]
    fn nettoyage() {
        assert_eq!(clean_device(" Mac <\"de\" 'Draco'>`\u{1}\u{7f} "), "Mac de Draco");
        assert_eq!(clean_name("Draconix <b>"), "Draconix b");
        assert_eq!(clean_name("l'\"ami\""), "l'\"ami\"");
    }
}
