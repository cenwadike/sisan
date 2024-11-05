# Sisan(/see-sÖn/) 
Privacy-preserving decentralized payroll solution for enterprises and freelancers.

## Requirement

- A Payee can provide a payment invoice to a payer
- A payer can deposit on-chain assets for payment of invoices after a stipulated period
- A payer can cancel payment of an invoice before a critical period
- A payer can not cancel payment of an invoice after a critical period
- A payer must deposit enough assets to cover the payment of an invoice
- A payer can pay recurrently on an invoice from a payee
- A payer can cancel recurrent payment
- A payee can receive payment in `any` on-chain asset with sufficient liquidity
- A payer can pay in `any` on-chain asset with sufficient liquidity
- All transactions related to payment can be verified

## Architecture

### Flow

It describes how the system handles payment settlement between a payee and a payer

NB: this same flow can also describe a one-to-many relationship between a payee and payers.

payee → `submit invoice`

system → `record invoice param` + `emit invoice event`

payer → `accepts invoice` + `deposit enough asset` 

system → `emit acceptance event`

system → `open cancel period`

{ ***if:** `open cancel period` is not over, the payer can cancel the payment*

***else:** if the payer `cancel payment`, 50% of single invoice payment will be paid to the payee }*

system → ***If:*** `payment period` is reached, `transfer` the correct asset to the payee + `emit event`

### Data structure

#### Onchain Invoice

```rust
    struct Invoice {
        uint128 invoiceIdx;
        uint128 amount;
        uint128 criticalPeriod;
        address creator;
        address[] payers;
        bool recurrent;
        int128 numberOfRecurrentPayment;
        uint128 recurrentPaymentInterval;
        address validPaymentToken;
        uint128 lastWithdrawal;
        InvoiceStatus status;
    }
```

#### Invoice balances 

```rust
    // map(invoiceCreator, invoicePayer, invoiceIdx) -> encrypted-balance
    mapping (address => mapping(address => mapping(uint => euint128))) balances;
```

#### Invoice by creator and index

```rust
    // maps creator address and invoice Idx to an invoice
    mapping (address => mapping (uint128 => Invoice) ) InvoicesByCreatorAddressAndInvoiceIdx;
```

#### Invoice by payer and index

```rust
    // maps payer address and invoice Idx to an invoice
    mapping (address => mapping (uint128 => Invoice) ) InvoicesByPayerAddressAndInvoiceIdx;
```

#### Invoice by index

```rust
    // maps invoice Idx to an invoice
    mapping (uint128 => Invoice) InvoicesByIdx;
```

### Interface

```js
Interface Sisan {
    function createInvoice(
        uint128 _amount, 
        bool _recurrent, 
        uint128 _numberOfRecurrentPayment, 
        uint128 _recurrentPaymentInterval,
        uint128 _criticalPeriod,
        address _validPaymentToken, 
        address[] memory _payers
    ) external returns (uint128 invoiceIdx);

    function acceptInvoice(
        uint128 invoiceIdx,
        bool recurrent
    ) payable external;

    function cancelPayment(
        uint128 invoiceIdx
    ) payable external;

    function withdrawPayment(
        uint128 invoiceIdx,
        address payer
    ) external;

    function getInvoice(
        uint128 invoiceIdx
    ) view external returns(Invoice memory invoice);

    function getInvoiceBalance(
        address creator,
        address payer,
        uint128 invoiceIdx
    ) view external returns(uint balance);

    function getInvoiceByCreatorAndIdx(
        address creator,
        uint128 invoiceIdx
    ) view external returns(Invoice memory invoice);

    function getInvoiceByPayerAndIdx(
        address payer,
        uint128 invoiceIdx
    ) view external returns(Invoice memory invoice)
}
```


## Develop

### Edit `.env` file

- Copy `.env.copy` to `.env`

```bash
cp .env.copy .env
```

- Provide fhenix private key

```bash
PRIVATE_KEY=<fhenix-private-key>
```

### Build

```bash
yarn
```

```bash
npx hardhat compile
```

### Test

```bash
pnpm hardhat localfhenix:start
```

```bash
npx hardhat test --network localfhenix
```

#### Note

##### Withdrawal test

Because localfhenix does not support chain fast forwarding, comment lines `261` to `263` of **Sisan.sol** and uncomment withdrawal tests.

### Deploy

#### Deploy on local fhenix

- Open another terminal and run

```bash
pnpm hardhat localfhenix:start
```

- Run the command below in a separate terminal

```bash
 npx hardhat ignition deploy ./ignition/modules/Sisan.js --network localfhenix 
```

#### Deploy on fhenix testnet

- Run the command

```bash
npx hardhat ignition deploy ./ignition/modules/Sisan.js --network fhenixHeliumTestnet
```

### Contract address

- 0x203cdb9736B57B080D68cb88739C155bC95CbE4f (fhenixHeliumTestnet)
