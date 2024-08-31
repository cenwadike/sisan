// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Sisan is Ownable, ReentrancyGuard {
    uint256 public currentInvoiceIdx;

    // default critical period is 7 days.
    // using DAILY_AVERAGE_BLOCK to be 7152 (https://ycharts.com/indicators/ethereum_blocks_per_day)
    // default critical period => 7152*7
    uint256 public defaultCriticalPeriod;

    uint256 private DAILY_AVERAGE_BLOCK = 7152;
    address private ETH_TOKEN_PLACEHOLDER = 0x0000000000000000000000000000000000000000;

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

    // map(invoiceCreator, invoicePayer, invoiceIdx) -> balance
    mapping (address => mapping(address => mapping(uint => uint))) balances;

    enum InvoiceStatus {
        Created,
        Accepted,
        Cancelled,
        Completed
    }

    // maps creator address and invoice Idx to an invoice
    mapping (address => mapping (uint256 => Invoice) ) InvoicesByCreatorAddressAndInvoiceIdx;

    // maps creator address and invoice Idx to an invoice
    mapping (address => mapping (uint256 => Invoice) ) InvoicesByPayerAddressAndInvoiceIdx;

    // maps invoice Idx to an invoice
    mapping (uint256 => Invoice) InvoicesByIdx;

    event Initialized(address owner);
    event InvoiceCreated(uint256 invoiceIdx, address creator, uint256 amount, address validPaymentToken);
    event InvoiceAccepted(uint256 invoiceIdx, address payer, uint256 amount, address validPaymentToken);
    event PaymentCanceled(uint256 invoiceIdx, address creator, address payer);
    event PaymentWithdrawn(uint256 invoiceIdx);
    event InvoiceCompleted(uint256 invoiceIdx);
    event EthRecieved(uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {
        currentInvoiceIdx = 0;
        defaultCriticalPeriod = DAILY_AVERAGE_BLOCK * 7;

        emit Initialized(owner());
    }

    receive() external payable{
        emit EthRecieved(msg.value);
    }

    function createInvoice(
        uint256 _amount, 
        bool _recurrent, 
        uint256 _numberOfRecurrentPayment, 
        uint256 _recurrentPaymentInterval,
        uint256 _criticalPeriod,
        address _validPaymentToken, 
        address[] memory _payers
    ) external returns (uint256 invoiceIdx) {
        uint256 len = _payers.length;
        for(uint256 i = 0; i < len; i++ ){
            require(_payers[i] != msg.sender, "Sisan::acceptInvoice::Creator can not be payer");
        }

        require(_criticalPeriod >= defaultCriticalPeriod, 
            "Sisan::acceptInvoice::Critical period must be at least 7 days"
        );

        Invoice memory invoice = Invoice({
            invoiceIdx: currentInvoiceIdx,
            amount: _amount,
            criticalPeriod: block.number + _criticalPeriod,
            creator: msg.sender,
            payers: _payers,
            recurrent: _recurrent,
            numberOfRecurrentPayment: int(_numberOfRecurrentPayment),
            recurrentPaymentInterval: _recurrentPaymentInterval,
            validPaymentToken: _validPaymentToken,
            lastWithdrawal: block.number,
            status: InvoiceStatus.Created
        });

        InvoicesByCreatorAddressAndInvoiceIdx[invoice.creator][invoice.invoiceIdx] = invoice;
        InvoicesByIdx[invoice.invoiceIdx] = invoice;
        currentInvoiceIdx++;

        emit InvoiceCreated(invoiceIdx, msg.sender, _amount, _validPaymentToken);

        return invoice.invoiceIdx;
    }

    function acceptInvoice(
        uint256 invoiceIdx,
        bool recurrent
    ) payable external nonReentrant {
        // get invoice
        Invoice memory invoice = InvoicesByIdx[invoiceIdx];

        // ensure payment is factored for recurrent paymment
        require(recurrent == invoice.recurrent, "Sisan::acceptInvoice::Payment must be recurrent");

        // ensure caller is a valid payer
        uint256 len = invoice.payers.length;
        bool isValidPayer = false;

        for(uint256 i = 0; i < len; i++){
            if(invoice.payers[i] == msg.sender) {
                isValidPayer = true;
            }
        } 

        require(isValidPayer, "Sisan::cancelPayment::Only valid payer can accept payment");

        // update invoice status
        invoice.status = InvoiceStatus.Accepted;
        InvoicesByIdx[invoiceIdx] = invoice;
        InvoicesByPayerAddressAndInvoiceIdx[msg.sender][invoiceIdx] = invoice;

        // update balance
        balances[invoice.creator][msg.sender][invoice.invoiceIdx] = invoice.amount * uint(invoice.numberOfRecurrentPayment);

        // verify attached ether
        if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
            if(invoice.recurrent) {
                uint256 attachedAmmount = msg.value * uint(invoice.numberOfRecurrentPayment);
                require(attachedAmmount == msg.value, "Sisan::acceptInvoice::Insufficient ether attached");
            } else {
                require(invoice.amount == msg.value, "Sisan::acceptInvoice::Insufficient ether attached");         
            }
        }

        // verify erc20 token allowance and transfer allowed tokens
        if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
            IERC20 token = IERC20(invoice.validPaymentToken);
            uint256 allowance = token.allowance(msg.sender, address(this));

            if(invoice.recurrent) {
                uint256 requiredAmmount = invoice.amount * uint(invoice.numberOfRecurrentPayment);
                require(requiredAmmount == allowance, "Sisan::acceptInvoice::Insufficient allowance");
                token.transferFrom(msg.sender, address(this), requiredAmmount);
            } else {
                require(invoice.amount == allowance,  "Sisan::acceptInvoice::Insufficient token attached"); 
                token.transferFrom(msg.sender, address(this), allowance);      
            }
        }

        emit InvoiceAccepted(invoiceIdx, msg.sender, invoice.amount, invoice.validPaymentToken);
    }

    function cancelPayment(
        uint256 invoiceIdx
    ) payable external nonReentrant {
        Invoice memory invoice = InvoicesByIdx[invoiceIdx]; 

        // ensure caller is a valid payer
        uint256 len = invoice.payers.length;
        bool isValidPayer = false;

        for(uint256 i = 0; i < len; i++){
            if(invoice.payers[i] == msg.sender) {
                isValidPayer = true;
            }
        } 

        require(isValidPayer, "Sisan::cancelPayment::Only valid payer can cancel payment");

        // if one to many pop out canceled payer from array
        if(len > 1) {
            for(uint256 i = 0; i < len; i++) {
                if(invoice.payers[i] == msg.sender) {
                    delete invoice.payers[i];
                } 
            }
        }

        // update state to Created if one to one invoice
        if(invoice.payers[len-1] == address(0)) {
            invoice.status = InvoiceStatus.Cancelled;
        }
        InvoicesByIdx[invoiceIdx] = invoice; 

        if(block.number > invoice.criticalPeriod) {
            // transfer 50% of payment to payer and 50% to payee

            // check if valid token is eth
            // if true, transfer 50% to payer and 50% to payee
            if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                payable(msg.sender).transfer(invoice.amount/2);
                payable(invoice.creator).transfer(invoice.amount/2);
            }

            
            // check if valid token is erc29 token
            // if true, transfer 50% to payer and 50% to payee  
            if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
                IERC20 token = IERC20(invoice.validPaymentToken);

                token.transfer(msg.sender, invoice.amount/2);
                token.transfer(invoice.creator, invoice.amount/2);
            }           
        }else {
            // transfer 100% to payer

            // check if valid token is eth
            // if true, transfer 100% to payer
            if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                payable(msg.sender).transfer(invoice.amount);
            }

            // check if valid token is eth
            // if true, transfer 100% to payer
            if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
                IERC20 token = IERC20(invoice.validPaymentToken);
                token.transfer(msg.sender, invoice.amount);
            }
        } 

        // emit event
        emit PaymentCanceled(invoice.invoiceIdx, invoice.creator, msg.sender);
    }

    function withdrawPayment(
        uint256 invoiceIdx,
        address payer
    ) external nonReentrant {
        Invoice memory invoice = InvoicesByIdx[invoiceIdx]; 

        require(invoice.creator == msg.sender, 
            "Sisan::withdrawPayment::Only valid creator can withdraw payment"
        );

        // require(block.number > invoice.criticalPeriod, 
        //     "Sisan::withdrawPayment::Can only withdraw after critical period"
        // );

        require(invoice.status == InvoiceStatus.Accepted, 
            "Sisan::withdrawPayment::Invoice not accepted"
        );

        require(balances[invoice.creator][payer][invoice.invoiceIdx] > 0,
            "Sisan::withdrawPayment::Invoice payment complete"
        );

        if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
            IERC20 token = IERC20(address(invoice.validPaymentToken));

            require(token.balanceOf(address(this)) >= invoice.amount,
                "Sisan::withdrawPayment::Insufficint token balance in contract"
            );
        }

        invoice.numberOfRecurrentPayment--;

        // if payment is recurrent, check how many payment is left to be withdrawn
        // transfer amount * number of payment not withdrawn
        if (invoice.numberOfRecurrentPayment > 0) {
            uint256 lasWithdrawalPeriod = block.number - invoice.lastWithdrawal;
            uint256 missedPaymentWithdrawal = lasWithdrawalPeriod/invoice.recurrentPaymentInterval;

            uint256 amountToTransfer = missedPaymentWithdrawal * invoice.amount;
            balances[invoice.creator][payer][invoice.invoiceIdx] -= amountToTransfer;

            if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                payable(msg.sender).transfer(amountToTransfer);
            } else {
                IERC20 token = IERC20(invoice.validPaymentToken);
                token.transfer(msg.sender, amountToTransfer);
            }
        }
        if(invoice.numberOfRecurrentPayment <= 0) {
            if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                payable(msg.sender).transfer(invoice.amount);
            } else {
                IERC20 token = IERC20(invoice.validPaymentToken);
                token.transfer(msg.sender, invoice.amount);
            }            

            balances[invoice.creator][payer][invoice.invoiceIdx] -= invoice.amount;

            invoice.status = InvoiceStatus.Completed;
            emit InvoiceCompleted(invoice.invoiceIdx);
        }

        emit PaymentWithdrawn(invoice.invoiceIdx);
    }

    function getInvoice(
        uint256 invoiceIdx
    ) view external returns(Invoice memory invoice) {
        return InvoicesByIdx[invoiceIdx];
    }

    function getInvoiceBalance(
        address creator,
        address payer,
        uint256 invoiceIdx
    ) view external returns(uint balance) {
        return balances[creator][payer][invoiceIdx];
    }

    function getInvoiceByCreatorAndIdx(
        address creator,
        uint256 invoiceIdx
    ) view external returns(Invoice memory invoice) {
        return InvoicesByCreatorAddressAndInvoiceIdx[creator][invoiceIdx];
    }

    function getInvoiceByPayerAndIdx(
        address payer,
        uint256 invoiceIdx
    ) view external returns(Invoice memory invoice) {
        return InvoicesByPayerAddressAndInvoiceIdx[payer][invoiceIdx];
    }
}
