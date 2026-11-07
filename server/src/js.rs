//! Coercions « à la JavaScript » reproduites volontairement (design D7) : le serveur précédent,
//! écrit en JavaScript, acceptait par exemple `"5"` pour un nombre ou `12` pour une adresse ;
//! les résultats doivent rester les mêmes.
use serde_json::Value;

/// Espaces au sens de `\s` et de `String.prototype.trim` en JavaScript.
pub fn is_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'
    )
}

pub fn trim(s: &str) -> &str {
    s.trim_matches(is_space)
}

/// Longueur JavaScript (`.length`) : en unités UTF-16.
pub fn len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `s.slice(0, n)` en unités UTF-16 (une paire coupée en deux devient U+FFFD).
pub fn slice(s: &str, n: usize) -> String {
    if s.len() <= n {
        return s.to_string(); // octets ≤ n ⇒ unités UTF-16 ≤ n
    }
    let u: Vec<u16> = s.encode_utf16().take(n).collect();
    String::from_utf16_lossy(&u)
}

/// Écriture d'un nombre comme `String(n)` en JavaScript.
pub fn num_to_string(n: f64) -> String {
    if n.is_nan() {
        "NaN".into()
    } else if n.is_infinite() {
        if n > 0.0 { "Infinity".into() } else { "-Infinity".into() }
    } else if n == n.trunc() && n.abs() < 1e21 {
        format!("{}", n as i128)
    } else {
        let s = format!("{n:e}");
        // Rust : 1.5e-7, 1e21 ; JavaScript : 1.5e-7, 1e+21
        if n.abs() >= 1e21 {
            s.replace('e', "e+")
        } else if n.abs() < 1e-6 {
            s
        } else {
            format!("{n}")
        }
    }
}

/// `String(v)` pour une valeur JSON (objets : « [object Object] », tableaux : éléments joints par des virgules).
pub fn to_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => num_to_string(n.as_f64().unwrap_or(f64::NAN)),
        Value::String(s) => s.clone(),
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { to_string(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// Vrai si la valeur est « fausse » en JavaScript.
pub fn falsy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => true,
        Some(Value::Bool(b)) => !b,
        Some(Value::Number(n)) => n.as_f64().map(|x| x == 0.0 || x.is_nan()).unwrap_or(false),
        Some(Value::String(s)) => s.is_empty(),
        _ => false,
    }
}

/// `String(v || '')`
pub fn str_or_empty(v: Option<&Value>) -> String {
    if falsy(v) { String::new() } else { to_string(v.unwrap()) }
}

/// `String(v ?? '')`
pub fn str_nullish(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => String::new(),
        Some(x) => to_string(x),
    }
}

/// `Number(s)` pour une chaîne.
pub fn str_to_num(s: &str) -> f64 {
    let t = trim(s);
    if t.is_empty() {
        return 0.0;
    }
    let (neg, body) = match t.as_bytes()[0] {
        b'-' => (true, &t[1..]),
        b'+' => (false, &t[1..]),
        _ => (false, t),
    };
    let lower = body.to_ascii_lowercase();
    if t.len() > 2 && !t.starts_with(['+', '-']) && (lower.starts_with("0x") || lower.starts_with("0o") || lower.starts_with("0b")) {
        let radix = match &lower[..2] { "0x" => 16, "0o" => 8, _ => 2 };
        return u128::from_str_radix(&body[2..], radix).map(|x| x as f64).unwrap_or(f64::NAN);
    }
    if body == "Infinity" {
        return if neg { f64::NEG_INFINITY } else { f64::INFINITY };
    }
    // la syntaxe décimale de JavaScript : chiffres, point, exposant ; pas « inf », « nan », « 1_0 »
    let ok = !body.is_empty() && body.bytes().all(|b| b.is_ascii_digit() || matches!(b, b'.' | b'e' | b'E' | b'+' | b'-')) && body.bytes().any(|b| b.is_ascii_digit());
    match (ok, body.parse::<f64>()) {
        (true, Ok(x)) => if neg { -x } else { x },
        _ => f64::NAN,
    }
}

/// `+v` pour une valeur JSON.
pub fn to_num(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => if *b { 1.0 } else { 0.0 },
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => str_to_num(s),
        Some(a @ Value::Array(_)) => str_to_num(&to_string(a)),
        Some(Value::Object(_)) => f64::NAN,
    }
}

/// `Math.max(0, +v || 0)`
pub fn non_negative(n: f64) -> f64 {
    let n = if n.is_nan() { 0.0 } else { n };
    n.max(0.0)
}

/// Un nombre JSON tel que JavaScript l'écrirait (entier sans « .0 »).
pub fn num(n: f64) -> Value {
    if n == n.trunc() && n.abs() < 9_007_199_254_740_992.0 {
        Value::from(n as i64)
    } else {
        serde_json::Number::from_f64(n).map(Value::Number).unwrap_or(Value::Null)
    }
}

/// Retire les espaces hors des chaînes d'un texte JSON valide, comme le ferait `JSON.stringify(JSON.parse(t))`
/// pour un JSON déjà écrit par `JSON.stringify` (ce qu'envoient les appareils), sans construire d'arbre.
pub fn compact_json(t: &str) -> String {
    let mut out = String::with_capacity(t.len());
    let (mut in_str, mut esc) = (false, false);
    for c in t.chars() {
        if in_str {
            out.push(c);
            if esc {
                esc = false;
            } else if c == '\\' {
                esc = true;
            } else if c == '"' {
                in_str = false;
            }
        } else if c == '"' {
            in_str = true;
            out.push(c);
        } else if !matches!(c, ' ' | '\t' | '\n' | '\r') {
            out.push(c);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn coercions() {
        assert_eq!(str_or_empty(Some(&json!(0))), "");
        assert_eq!(str_or_empty(Some(&json!(12))), "12");
        assert_eq!(str_or_empty(Some(&json!(1.5))), "1.5");
        assert_eq!(str_or_empty(Some(&json!(true))), "true");
        assert_eq!(str_or_empty(Some(&json!({"a":1}))), "[object Object]");
        assert_eq!(str_or_empty(Some(&json!([1, null, "a"]))), "1,,a");
        assert_eq!(str_nullish(Some(&json!(false))), "false");
        assert_eq!(str_nullish(None), "");
        assert_eq!(non_negative(to_num(Some(&json!("5")))), 5.0);
        assert_eq!(non_negative(to_num(Some(&json!(" 7 ")))), 7.0);
        assert_eq!(non_negative(to_num(Some(&json!("abc")))), 0.0);
        assert_eq!(non_negative(to_num(Some(&json!(-3)))), 0.0);
        assert_eq!(non_negative(to_num(Some(&json!(true)))), 1.0);
        assert_eq!(non_negative(to_num(Some(&json!([4])))), 4.0);
        assert_eq!(non_negative(to_num(Some(&json!({})))), 0.0);
        assert_eq!(non_negative(to_num(None)), 0.0);
        assert_eq!(str_to_num("1e3"), 1000.0);
        assert_eq!(str_to_num("0x10"), 16.0);
        assert!(str_to_num("inf").is_nan());
        assert_eq!(str_to_num(""), 0.0);
        assert_eq!(num_to_string(1e21), "1e+21");
        assert_eq!(num_to_string(-0.0), "0");
    }

    #[test]
    fn longueurs() {
        assert_eq!(len("é"), 1);
        assert_eq!(len("😀"), 2);
        assert_eq!(slice("abcdef", 3), "abc");
        assert_eq!(slice("a😀", 2), "a\u{fffd}");
        assert_eq!(trim("\u{feff} a \u{a0}"), "a");
    }

    #[test]
    fn compact() {
        assert_eq!(compact_json("{ \"a\" : [1, 2],\n \"b\": \"x y\\\" z\" }"), "{\"a\":[1,2],\"b\":\"x y\\\" z\"}");
    }
}
