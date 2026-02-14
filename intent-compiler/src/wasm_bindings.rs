//! WASM bindings for the intent compiler.
//! These functions are only compiled when the `wasm` feature is enabled.

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
use crate::{
    analyze_intent_full, extract_actors, extract_data_flows, extract_features,
    extract_tech_stack_hints, generate_plan_from_text, get_simd_support, parse_and_plan,
    parse_intent, parse_intents_batch,
};

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_intent_wasm(text: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let intent = parse_intent(text, constraints);

    serde_wasm_bindgen::to_value(&intent)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_intents_batch_wasm(
    texts: Vec<String>,
    constraints_json: &str,
) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let text_refs: Vec<&str> = texts.iter().map(|s| s.as_str()).collect();
    let results = parse_intents_batch(&text_refs, constraints);

    serde_wasm_bindgen::to_value(&results)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_actors_wasm(text: &str) -> Vec<String> {
    extract_actors(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_features_wasm(text: &str) -> Vec<String> {
    extract_features(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_data_flows_wasm(text: &str) -> Vec<String> {
    extract_data_flows(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_tech_stack_hints_wasm(text: &str) -> Vec<String> {
    extract_tech_stack_hints(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn get_simd_support_wasm() -> String {
    get_simd_support()
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn analyze_intent_full_wasm(text: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let analysis = analyze_intent_full(text, constraints);

    serde_wasm_bindgen::to_value(&analysis)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn generate_plan_wasm(goal: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let plan = generate_plan_from_text(goal, constraints);

    serde_wasm_bindgen::to_value(&plan)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_and_plan_wasm(goal: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let (intent, plan) = parse_and_plan(goal, constraints);

    // Return as a combined object
    let result = serde_json::json!({
        "intent": intent,
        "plan": plan
    });

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
