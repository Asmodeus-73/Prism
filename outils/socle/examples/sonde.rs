use std::sync::Arc;
fn main() {
    let p = std::env::args().nth(1).unwrap();
    let o = Arc::new(std::fs::read(&p).unwrap());
    let n = socle::Nature::de(std::path::Path::new(&p));
    if n == socle::Nature::Raw {
        let src = rawler::rawsource::RawSource::new_from_shared_vec(o.clone());
        let d = rawler::get_decoder(&src).unwrap();
        let img = d.raw_image(&src, &Default::default(), false).unwrap();
        if let rawler::RawImageData::Integer(v) = &img.data {
            let w = img.width * img.cpp;
            for y in (0..img.height).step_by(img.height / 20) {
                let l = &v[y * w..(y + 1) * w];
                let m: u64 = l.iter().map(|&x| x as u64).sum::<u64>() / w as u64;
                let z = l.iter().filter(|&&x| x == 0).count();
                println!("y={y} moy={m} zeros={z}/{w}");
            }
        }
    } else {
        let mut d = zune_jpeg::JpegDecoder::new(&o[..]);
        let px = d.decode().unwrap();
        let i = d.info().unwrap();
        let w = i.width as usize * 3;
        for y in (1990..2140).step_by(6) {
            let l = &px[y * w..(y + 1) * w];
            let m: u64 = l.iter().map(|&x| x as u64).sum::<u64>() / w as u64;
            // variation entre pixels voisins
            let dv: u64 = l.chunks(3).collect::<Vec<_>>().windows(2).map(|p| (p[0][1] as i32 - p[1][1] as i32).unsigned_abs() as u64).sum::<u64>() / (w as u64 / 3);
            let u = l.chunks(3).filter(|c| c.iter().zip(&l[..3]).any(|(a,b)| (*a as i32 - *b as i32).abs() > 3)).count(); println!("y={y} moy={m} grad={dv} hors={u}");
        }
    }
}
