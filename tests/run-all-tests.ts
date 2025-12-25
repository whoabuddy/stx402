import { testX402ManualFlow as testDecodeClarity } from "./decode-clarity-hex.test.js";
import { testX402ManualFlow as testConvertAddress } from "./convert-address-to-network.test.js";
import { testX402ManualFlow as testGetBns } from "./get-bns-address.test.js";
import { testX402ManualFlow as testValidateAddress } from "./validate-stacks-address.test.js";

async function runAllTests() {
  console.log("🚀 Starting all X402 tests...\n");
  
  try { await testDecodeClarity(); console.log(); } catch (e) { console.error("❌ decode-clarity-hex failed:", e); console.log(); }
  try { await testConvertAddress(); console.log(); } catch (e) { console.error("❌ convert-address-to-network failed:", e); console.log(); }
  try { await testGetBns(); console.log(); } catch (e) { console.error("❌ get-bns-address failed:", e); console.log(); }
  try { await testValidateAddress(); console.log(); } catch (e) { console.error("❌ validate-stacks-address failed:", e); console.log(); }
  
  console.log("✅ All tests completed!");
}

runAllTests().catch(console.error);
