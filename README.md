# Sisan(/see-sÖn/) 
Privacy-preserving decentralized payroll solution.

## Requirement

- An employee can provide a payment invoice to an employer
- An employer can deposit on-chain assets for payment of invoices after a stipulated period of time
- An employer can cancel payment of an invoice before a critical period of time
- An employer can not cancel payment of an invoice after a critical period of time
- An employer must deposit enough assets to cover the payment of an invoice
- An employer can pay recurrently on an invoice from an employee
- An employer can cancel recurrent payment
- An employee can receive payment in `any` on-chain asset with sufficient liquidity
- An employer can pay in `any` on-chain asset with sufficient liquidity
- All transactions related to payment can be verified

## Architecture

### Flow

It describes how the system handles payment settlement between an employee and an employer

NB: this same flow can also describe a one-to-many relationship between an employee and employers.

employee → `submit invoice`

system → `record invoice param` + `emit invoice event`

employer → `accepts invoice` + `deposit enough asset` 

system → `emit acceptance event`

system → `open cancel period`

{ ***if:** `open cancel period` is not over, the employer can cancel the payment*

***else:** if the employer `cancel payment`, 50% of the invoice will be paid to the employee }*

system → ***If:*** `payment period` is reached, `transfer` the correct asset to the employee + `emit event`

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

- Provide owner address in `ignition/modules/Sisan.js`

### Build

```bash
npm i
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

- 0xf38f8c730FE7f6e272eBAcd1AE6fF40361c6E7ED (fhenixHeliumTestnet)