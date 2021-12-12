use regex::Regex;

pub fn find_main_js(homepage_html: &str) -> Option<&str> {
    let re = Regex::new(r"https://abs\.twimg\.com/responsive-web/client-web/main\.[a-f0-9]+\.js").unwrap();
    re.find(homepage_html).map_or(None, |m| Some(m.as_str()))
}

#[cfg(test)]
mod test {
    use crate::homepage::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn test_find_main_js() {
        let mut rc = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        rc.push("resources/test/twitter_homepage.html");
        let homepage_html = fs::read_to_string(rc.as_path()).unwrap();
        assert_eq!(find_main_js(&homepage_html), Some("https://abs.twimg.com/responsive-web/client-web/main.4722fff5.js"));
    }
}
