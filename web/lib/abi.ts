// ABI de BrasaFund v3. GENERADO por web/scripts/generar-abi.mjs desde contracts/artifacts: no editar a mano.
export const FUND_ABI = [
 {
  "inputs": [],
  "name": "BadConfig",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "BadReports",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "BadSigner",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "BelowMinDonation",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "CooldownActive",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "ECDSAInvalidSignature",
  "type": "error"
 },
 {
  "inputs": [
   {
    "internalType": "uint256",
    "name": "length",
    "type": "uint256"
   }
  ],
  "name": "ECDSAInvalidSignatureLength",
  "type": "error"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "s",
    "type": "bytes32"
   }
  ],
  "name": "ECDSAInvalidSignatureS",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "InvalidShortString",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NoResponders",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NonceUsed",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NotEnoughHotspots",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NotFederation",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NotPendingFederation",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NotYetActive",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "NothingPending",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "ProposalExpired",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "RecipientInactive",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "ReentrancyGuardReentrantCall",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "ReportsTooFarApart",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "RotationInProgress",
  "type": "error"
 },
 {
  "inputs": [
   {
    "internalType": "address",
    "name": "token",
    "type": "address"
   }
  ],
  "name": "SafeERC20FailedOperation",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "StaleReport",
  "type": "error"
 },
 {
  "inputs": [
   {
    "internalType": "string",
    "name": "str",
    "type": "string"
   }
  ],
  "name": "StringTooLong",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "TooManyRecipients",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "UnknownRecipient",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "UnknownZone",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "WrongPolygon",
  "type": "error"
 },
 {
  "inputs": [],
  "name": "ZoneExists",
  "type": "error"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "targetId",
    "type": "bytes32"
   },
   {
    "indexed": true,
    "internalType": "address",
    "name": "donor",
    "type": "address"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "net",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "fee",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "bool",
    "name": "direct",
    "type": "bool"
   }
  ],
  "name": "Donated",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [],
  "name": "EIP712DomainChanged",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "address",
    "name": "previous",
    "type": "address"
   },
   {
    "indexed": true,
    "internalType": "address",
    "name": "current",
    "type": "address"
   }
  ],
  "name": "FederationChanged",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "address",
    "name": "current",
    "type": "address"
   },
   {
    "indexed": true,
    "internalType": "address",
    "name": "pending",
    "type": "address"
   }
  ],
  "name": "FederationTransferStarted",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "address",
    "name": "treasury",
    "type": "address"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "amount",
    "type": "uint256"
   }
  ],
  "name": "FeeTaken",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "indexed": true,
    "internalType": "uint256",
    "name": "eventId",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "hotspots",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "areaHa",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "target",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "released",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "bytes32",
    "name": "dataHash0",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "bytes32",
    "name": "dataHash1",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "uint64",
    "name": "dataTime0",
    "type": "uint64"
   },
   {
    "indexed": false,
    "internalType": "uint64",
    "name": "dataTime1",
    "type": "uint64"
   }
  ],
  "name": "FireEvent",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "uint8",
    "name": "sensor",
    "type": "uint8"
   },
   {
    "indexed": true,
    "internalType": "address",
    "name": "previous",
    "type": "address"
   },
   {
    "indexed": true,
    "internalType": "address",
    "name": "current",
    "type": "address"
   }
  ],
  "name": "OracleChanged",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "uint8",
    "name": "sensor",
    "type": "uint8"
   }
  ],
  "name": "OracleProposalCancelled",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "uint8",
    "name": "sensor",
    "type": "uint8"
   },
   {
    "indexed": true,
    "internalType": "address",
    "name": "signer",
    "type": "address"
   },
   {
    "indexed": false,
    "internalType": "uint64",
    "name": "activeFrom",
    "type": "uint64"
   }
  ],
  "name": "OracleProposed",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "indexed": true,
    "internalType": "uint256",
    "name": "eventId",
    "type": "uint256"
   },
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "recipientId",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "amount",
    "type": "uint256"
   }
  ],
  "name": "PayoutFailed",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "id",
    "type": "bytes32"
   },
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "enum BrasaFund.Kind",
    "name": "kind",
    "type": "uint8"
   },
   {
    "indexed": false,
    "internalType": "address",
    "name": "wallet",
    "type": "address"
   },
   {
    "indexed": false,
    "internalType": "uint64",
    "name": "activeFrom",
    "type": "uint64"
   }
  ],
  "name": "RecipientAdded",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "id",
    "type": "bytes32"
   },
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   }
  ],
  "name": "RecipientRevoked",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "indexed": true,
    "internalType": "uint256",
    "name": "eventId",
    "type": "uint256"
   },
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "recipientId",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "address",
    "name": "wallet",
    "type": "address"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "amount",
    "type": "uint256"
   }
  ],
  "name": "Released",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "bytes32[]",
    "name": "ids",
    "type": "bytes32[]"
   },
   {
    "indexed": false,
    "internalType": "uint64",
    "name": "validUntil",
    "type": "uint64"
   }
  ],
  "name": "RespondersSet",
  "type": "event"
 },
 {
  "anonymous": false,
  "inputs": [
   {
    "indexed": true,
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "bytes32",
    "name": "polygonHash",
    "type": "bytes32"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "costPerHa",
    "type": "uint256"
   },
   {
    "indexed": false,
    "internalType": "uint256",
    "name": "maxPerEvent",
    "type": "uint256"
   }
  ],
  "name": "ZoneCreated",
  "type": "event"
 },
 {
  "inputs": [],
  "name": "HA_PER_HOTSPOT",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_ASSIGNMENT",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_COOLDOWN",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_COST_PER_HA",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_DATA_AGE",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_DELAY",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_FEE_BPS",
  "outputs": [
   {
    "internalType": "uint16",
    "name": "",
    "type": "uint16"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_RECIPIENTS_PER_GROUP",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_REPORT_AGE",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "MAX_REPORT_SPREAD",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "ORACLE_PROPOSAL_WINDOW",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "acceptFederation",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "uint8",
    "name": "sensor",
    "type": "uint8"
   }
  ],
  "name": "acceptOracle",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "id",
    "type": "bytes32"
   },
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "internalType": "enum BrasaFund.Kind",
    "name": "kind",
    "type": "uint8"
   },
   {
    "internalType": "address",
    "name": "wallet",
    "type": "address"
   }
  ],
  "name": "addRecipient",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   }
  ],
  "name": "assistanceIds",
  "outputs": [
   {
    "internalType": "bytes32[]",
    "name": "",
    "type": "bytes32[]"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "uint8",
    "name": "sensor",
    "type": "uint8"
   }
  ],
  "name": "cancelOracle",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "internalType": "bytes32",
    "name": "polygonHash",
    "type": "bytes32"
   },
   {
    "internalType": "uint16",
    "name": "minHotspots",
    "type": "uint16"
   },
   {
    "internalType": "uint64",
    "name": "cooldown",
    "type": "uint64"
   },
   {
    "internalType": "uint256",
    "name": "maxPerEvent",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "costCombatPerHa",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "costLogisticsPerHa",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "costAssistPerHa",
    "type": "uint256"
   }
  ],
  "name": "createZone",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "domainSeparator",
  "outputs": [
   {
    "internalType": "bytes32",
    "name": "",
    "type": "bytes32"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "recipientId",
    "type": "bytes32"
   },
   {
    "internalType": "uint256",
    "name": "amount",
    "type": "uint256"
   },
   {
    "internalType": "bool",
    "name": "coverFee",
    "type": "bool"
   }
  ],
  "name": "donateToRecipient",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "internalType": "uint256",
    "name": "amount",
    "type": "uint256"
   },
   {
    "internalType": "bool",
    "name": "coverFee",
    "type": "bool"
   }
  ],
  "name": "donateToZone",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "eip712Domain",
  "outputs": [
   {
    "internalType": "bytes1",
    "name": "fields",
    "type": "bytes1"
   },
   {
    "internalType": "string",
    "name": "name",
    "type": "string"
   },
   {
    "internalType": "string",
    "name": "version",
    "type": "string"
   },
   {
    "internalType": "uint256",
    "name": "chainId",
    "type": "uint256"
   },
   {
    "internalType": "address",
    "name": "verifyingContract",
    "type": "address"
   },
   {
    "internalType": "bytes32",
    "name": "salt",
    "type": "bytes32"
   },
   {
    "internalType": "uint256[]",
    "name": "extensions",
    "type": "uint256[]"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "eventCount",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "federation",
  "outputs": [
   {
    "internalType": "address",
    "name": "",
    "type": "address"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "feeBps",
  "outputs": [
   {
    "internalType": "uint16",
    "name": "",
    "type": "uint16"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "lastOracleChange",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "minDonation",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "address",
    "name": "",
    "type": "address"
   },
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "name": "nonceUsed",
  "outputs": [
   {
    "internalType": "bool",
    "name": "",
    "type": "bool"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "oracle0",
  "outputs": [
   {
    "internalType": "address",
    "name": "",
    "type": "address"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "oracle1",
  "outputs": [
   {
    "internalType": "address",
    "name": "",
    "type": "address"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "oracleDelay",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "pendingFederation",
  "outputs": [
   {
    "internalType": "address",
    "name": "",
    "type": "address"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "uint8",
    "name": "",
    "type": "uint8"
   }
  ],
  "name": "pendingOracle",
  "outputs": [
   {
    "internalType": "address",
    "name": "signer",
    "type": "address"
   },
   {
    "internalType": "uint64",
    "name": "activeFrom",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "internalType": "uint256",
    "name": "hotspots",
    "type": "uint256"
   }
  ],
  "name": "previewTarget",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "areaHa",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "target",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "uint8",
    "name": "sensor",
    "type": "uint8"
   },
   {
    "internalType": "address",
    "name": "signer",
    "type": "address"
   }
  ],
  "name": "proposeOracle",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "uint256",
    "name": "net",
    "type": "uint256"
   }
  ],
  "name": "quoteFee",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "uint256",
    "name": "amount",
    "type": "uint256"
   },
   {
    "internalType": "bool",
    "name": "coverFee",
    "type": "bool"
   }
  ],
  "name": "quoteSplit",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "net",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "fee",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "total",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "recipientDelay",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "",
    "type": "bytes32"
   }
  ],
  "name": "recipients",
  "outputs": [
   {
    "internalType": "address",
    "name": "wallet",
    "type": "address"
   },
   {
    "internalType": "enum BrasaFund.Kind",
    "name": "kind",
    "type": "uint8"
   },
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "internalType": "bool",
    "name": "active",
    "type": "bool"
   },
   {
    "internalType": "uint64",
    "name": "activeFrom",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "components": [
     {
      "internalType": "bytes32",
      "name": "zoneId",
      "type": "bytes32"
     },
     {
      "internalType": "bytes32",
      "name": "polygonHash",
      "type": "bytes32"
     },
     {
      "internalType": "uint8",
      "name": "sensor",
      "type": "uint8"
     },
     {
      "internalType": "uint16",
      "name": "hotspots",
      "type": "uint16"
     },
     {
      "internalType": "uint64",
      "name": "observedAt",
      "type": "uint64"
     },
     {
      "internalType": "uint64",
      "name": "dataTime",
      "type": "uint64"
     },
     {
      "internalType": "bytes32",
      "name": "dataHash",
      "type": "bytes32"
     },
     {
      "internalType": "uint256",
      "name": "nonce",
      "type": "uint256"
     }
    ],
    "internalType": "struct BrasaFund.FireReport[2]",
    "name": "reports",
    "type": "tuple[2]"
   },
   {
    "internalType": "bytes[2]",
    "name": "sigs",
    "type": "bytes[2]"
   }
  ],
  "name": "reportFire",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   }
  ],
  "name": "responders",
  "outputs": [
   {
    "internalType": "bytes32[]",
    "name": "ids",
    "type": "bytes32[]"
   },
   {
    "internalType": "uint64",
    "name": "validUntil",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "",
    "type": "bytes32"
   }
  ],
  "name": "respondersUntil",
  "outputs": [
   {
    "internalType": "uint64",
    "name": "",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "id",
    "type": "bytes32"
   }
  ],
  "name": "revokeRecipient",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   },
   {
    "internalType": "bytes32[]",
    "name": "ids",
    "type": "bytes32[]"
   },
   {
    "internalType": "uint64",
    "name": "validUntil",
    "type": "uint64"
   }
  ],
  "name": "setResponders",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   }
  ],
  "name": "stationIds",
  "outputs": [
   {
    "internalType": "bytes32[]",
    "name": "",
    "type": "bytes32[]"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "address",
    "name": "next",
    "type": "address"
   }
  ],
  "name": "transferFederation",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "treasury",
  "outputs": [
   {
    "internalType": "address",
    "name": "",
    "type": "address"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [],
  "name": "usdc",
  "outputs": [
   {
    "internalType": "contract IERC20",
    "name": "",
    "type": "address"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   }
  ],
  "name": "zoneBalance",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "zoneId",
    "type": "bytes32"
   }
  ],
  "name": "zoneTotals",
  "outputs": [
   {
    "internalType": "uint256",
    "name": "donated",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "released",
    "type": "uint256"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 },
 {
  "inputs": [
   {
    "internalType": "bytes32",
    "name": "",
    "type": "bytes32"
   }
  ],
  "name": "zones",
  "outputs": [
   {
    "internalType": "bool",
    "name": "exists",
    "type": "bool"
   },
   {
    "internalType": "uint16",
    "name": "minHotspots",
    "type": "uint16"
   },
   {
    "internalType": "uint64",
    "name": "cooldown",
    "type": "uint64"
   },
   {
    "internalType": "uint64",
    "name": "lastRelease",
    "type": "uint64"
   },
   {
    "internalType": "uint256",
    "name": "balance",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "totalDonated",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "totalReleased",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "maxPerEvent",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "costCombatPerHa",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "costLogisticsPerHa",
    "type": "uint256"
   },
   {
    "internalType": "uint256",
    "name": "costAssistPerHa",
    "type": "uint256"
   },
   {
    "internalType": "bytes32",
    "name": "polygonHash",
    "type": "bytes32"
   },
   {
    "internalType": "uint64",
    "name": "lastDataTime0",
    "type": "uint64"
   },
   {
    "internalType": "uint64",
    "name": "lastDataTime1",
    "type": "uint64"
   }
  ],
  "stateMutability": "view",
  "type": "function"
 }
] as const;

// Contrato v1 (anterior): solo lo que cambió de forma, para poder seguir leyéndolo.
export const V1_ZONES_ABI = [
  "function zones(bytes32) view returns (bool exists, uint16 minHotspots, uint64 cooldown, uint64 lastRelease, uint256 balance, uint256 maxPerEvent, uint256 costCombatPerHa, uint256 costLogisticsPerHa, uint256 costAssistPerHa, bytes32 polygonHash)",
] as const;

// Contrato v2: zones() no trae lastDataTime (lo agregó el v3). Con el ABI del v3 la lectura fallaría.
export const V2_ZONES_ABI = [
  "function zones(bytes32) view returns (bool exists, uint16 minHotspots, uint64 cooldown, uint64 lastRelease, uint256 balance, uint256 totalDonated, uint256 totalReleased, uint256 maxPerEvent, uint256 costCombatPerHa, uint256 costLogisticsPerHa, uint256 costAssistPerHa, bytes32 polygonHash)",
] as const;

// USDC: solo lo que usamos
export const ERC20_ABI = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;
