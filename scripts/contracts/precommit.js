import { validateStaticContracts } from "./common.js";

try {
  validateStaticContracts();
  console.log("Pre-commit contracts passed.");
} catch (error) {
  console.error(`\nContract check failed: ${error.message}`);
  process.exit(1);
}
