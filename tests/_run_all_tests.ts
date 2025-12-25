import { testX402ManualFlow as testDecodeClarity } from "./decode-clarity-hex.test.js";
import { testX402ManualFlow as testConvertAddress } from "./convert-address-to-network.test.js";
import { testX402ManualFlow as testGetBns } from "./get-bns-address.test.js";
import { testX402ManualFlow as testValidateAddress } from "./validate-stacks-address.test.js";

import { COLORS } from "./_shared_utils.js";

async function runAllTests() {
  const verbose = process.env.VERBOSE === "1";
  const clearScreen = process.env.CLEAR_SCREEN === "1";

  if (clearScreen) console.clear();

  console.log(`${COLORS.bright}🚀 Starting all X402 tests...${COLORS.reset}\n`);

  const tests = [
    { name: "decode-clarity-hex", fn: testDecodeClarity },
    { name: "convert-address-to-network", fn: testConvertAddress },
    { name: "get-bns-address", fn: testGetBns },
    { name: "validate-stacks-address", fn: testValidateAddress },
  ];

  let globalSuccess = 0;
  const globalTotal = tests.length;

  for (const t of tests) {
    console.log(`${COLORS.bright}━${"━".repeat(60)}━${COLORS.reset}`);
    console.log(`${COLORS.bright}🔄 Running ${COLORS.yellow}${t.name}${COLORS.reset}`);
    console.log(`${COLORS.bright}━${"━".repeat(60)}━${COLORS.reset}\n`);

    try {
      await t.fn(verbose);
      globalSuccess++;
    } catch (e) {
      console.log(`${COLORS.bright}${COLORS.red}💥 ${t.name.toUpperCase()} CRASHED:${COLORS.reset}`);
      console.error(e);
    }
    console.log();
  }

  const passRate = ((globalSuccess / globalTotal) * 100).toFixed(1);
  console.log(`${COLORS.bright}🎉 FINAL SUMMARY: ${globalSuccess}/${globalTotal} passed (${passRate}%)${COLORS.reset}`);
}

runAllTests().catch(console.error);
