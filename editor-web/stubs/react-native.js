// Stub for Vite web build — react-native is never used in the browser bundle
export default {};
export const Platform = { OS: "web", select: (obj) => obj.web ?? obj.default };
export const StyleSheet = { create: (s) => s };
export const View = "div";
export const Text = "span";
