fn main() {
    for p in std::env::args().skip(1) {
        let o = std::fs::read(&p).unwrap();
        let t = std::time::Instant::now();
        let v = socle::integre::tous(&o, 16 << 20);
        let d = socle::tiff::date(&o);
        println!("{p}: {:?} en {:?} ; date {:?}", v.iter().map(|f| (f.l, f.h, f.fin - f.debut)).collect::<Vec<_>>(), t.elapsed(), d);
    }
}
