import {
  BufferCV,
  ClarityType,
  cvToValue,
  fetchCallReadOnlyFunction,
  principalCV,
  serializeCV,
  TupleCV,
} from "@stacks/transactions";
import { getFetchOptions, setFetchOptions } from "@stacks/common";
import { getNetworkFromPrincipal } from "./network";
import { hexToAscii } from "./hex-to-ascii";

const BNS_CONTRACT_ADDRESS = "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF";
const BNS_CONTRACT_NAME = "BNS-V2";
const API_URL =
  "https://stacks-node-api.mainnet.stacks.co/v2/contracts/call-read";

// Top-level: Fix stacks.js fetch for Workers (runs once/module)
type StacksRequestInit = RequestInit & { referrerPolicy?: string };
const fetchOptions: StacksRequestInit = getFetchOptions();
delete fetchOptions.referrerPolicy;
setFetchOptions(fetchOptions);

type NameResponse = { name: BufferCV; namespace: BufferCV };
type BnsNameResponse =
  | { type: ClarityType.ResponseErr; value: string }
  | {
    type: ClarityType.ResponseOk;
    value: { type: ClarityType.OptionalSome; value: TupleCV<NameResponse> };
  };

export async function getNameFromAddress(address: string): Promise<string> {
  const addressCV = principalCV(address);
  const addressNetwork = getNetworkFromPrincipal(address)

  const result = await fetchCallReadOnlyFunction({
    contractAddress: BNS_CONTRACT_ADDRESS,
    contractName: BNS_CONTRACT_NAME,
    functionName: "get-primary",
    functionArgs: [addressCV],
    senderAddress: address,
    network: addressNetwork,
  }) as BnsNameResponse

  if (result.type === ClarityType.ResponseErr) {
    return "";
  }

  if (
    result.type === ClarityType.ResponseOk &&
    result.value?.type === ClarityType.OptionalSome
  ) {
    const tuple = result.value.value as TupleCV<NameResponse>;
    const { name, namespace } = tuple.value;
    const nameBuff = cvToValue(name);
    const namespaceBuff = cvToValue(namespace);
    const nameAscii = hexToAscii(nameBuff);
    const namespaceAscii = hexToAscii(namespaceBuff);

    return `${nameAscii}.${namespaceAscii}`;
  }

  return "";
}
