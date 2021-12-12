use regex::Regex;
use std::collections::HashMap;

pub fn find_main_js(homepage_html: &str) -> Option<&str> {
    let re = Regex::new(r"https://abs\.twimg\.com/responsive-web/client-web/main\.[a-f0-9]+\.js").unwrap();
    re.find(homepage_html).map_or(None, |m| Some(m.as_str()))
}

pub fn find_graphql_query_id<'a>(main_js: &'a str, operation_name: &'a str) -> Option<&'a str> {
    let mut rexp: String = r#"\{queryId:"([[:alnum:]\-_]+)",operationName:""#.into();
    rexp.push_str(operation_name);
    rexp.push_str(r#"","#);
    let re = Regex::new(&rexp).unwrap();
    re.captures(main_js).map_or(None, |captures| {
        captures.get(1).map_or(None, |capture| Some(capture.as_str()))
    })
}

pub type QueryId = String;
pub type OperationName = String;

pub fn find_graphql_query_ids(main_js: &str) -> HashMap<OperationName, QueryId> {
    let re = Regex::new(r#"\{queryId:"([[:alnum:]\-_]+)",operationName:"([[:alnum:]]+)","#).unwrap();
    let mut m = HashMap::<OperationName, QueryId>::new();
    for captures in re.captures_iter(main_js) {
        let operation_name: OperationName = String::from(captures.get(2).unwrap().as_str());
        let query_id: QueryId = String::from(captures.get(1).unwrap().as_str());
        m.insert(operation_name, query_id);
    }
    m
}

#[cfg(test)]
mod test {
    use crate::homepage::*;
    use std::fs;
    use std::path::PathBuf;

    fn load_resource(filename: &str) -> String {
        let mut rc = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        rc.push("resources/test");
        rc.push(filename);
        fs::read_to_string(rc.as_path()).unwrap()
    }

    #[test]
    fn test_find_main_js() {
        let homepage_html = load_resource("twitter_homepage.html");
        assert_eq!(find_main_js(&homepage_html), Some("https://abs.twimg.com/responsive-web/client-web/main.4722fff5.js"));
    }

    #[test]
    fn test_find_graphql_query_id() {
        let main_js = load_resource("main.js");
        assert!(find_graphql_query_id(&main_js, "TweetDetail").is_some());
        assert_eq!(find_graphql_query_id(&main_js, "TweetDetail").unwrap(), "WCPfjCbV22zfq-_pPrAGeQ");
    }

    #[test]
    fn test_find_graphql_query_ids() {
        let main_js = load_resource("main.js");
        let ops = find_graphql_query_ids(&main_js);
        assert!(ops.len() > 0);
        assert_eq!(ops.get("DeleteBookmark").unwrap(), "Wlmlj2-xzyS1GN3a6cj-mQ");
        assert_eq!(ops.get("TweetDetail").unwrap(), "WCPfjCbV22zfq-_pPrAGeQ");
    }
}
