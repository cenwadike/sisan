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
        uint256 invoiceIdx;
        uint256 amount;
        uint256 criticalPeriod;
        address creator;
        address[] payers;
        bool recurrent;
        int256 numberOfRecurrentPayment;
        uint256 recurrentPaymentInterval;
        address validPaymentToken;
        uint256 lastWithdrawal;
        InvoiceStatus status;
    }
```

#### Invoice balances 
```rust
    // map(invoiceCreator, invoicePayer, invoiceIdx) -> balance
    mapping (address => mapping(address => mapping(uint => uint))) balances;
```

### Interface

```rust
pub trait Contract {
 pub fn submit_invoice(param: Invoice) -> invoice_id;
 pub fn accept_invoice(?recurrent: bool, ?interval: u128);
 pub fn cancel_payment(invoice_id: u64);
 pub fn withdraw_payment(invoice_id: u64);
 pub fn get_employee_invoice(employee_pk: pub_key) -> Vec<Invoice>;
 pub fn get_employer_invoice(employer_pk: pub_key) -> Vec<Invoice>;
 ...
}
```


## Develop

### Build

```bash
npm i
```

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```
