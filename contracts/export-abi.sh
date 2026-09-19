#!/usr/bin/env bash
# Export ABIs to ../deployments/abi/*.json (consumed by web/ and mcp/)
set -e
cd "$(dirname "$0")"
forge build >/dev/null
mkdir -p ../deployments/abi
for c in IdentityRegistry ReputationRegistry AgentPassport DemoUSDT Groth16Verifier PassportRegistry; do
  python -c "import json; json.dump(json.load(open('out/$c.sol/$c.json'))['abi'], open('../deployments/abi/$c.json','w'), indent=2)"
done
echo "ABIs exported"
