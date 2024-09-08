// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@fhenixprotocol/contracts/FHE.sol";

contract Sisan is ReentrancyGuard {
    uint128 public currentInvoiceIdx;

    // default critical period is 7 days.
    // using DAILY_AVERAGE_BLOCK to be 7152 (https://ycharts.com/indicators/ethereum_blocks_per_day)
    // default critical period => 7152*7
    uint128 public defaultCriticalPeriod;

    uint128 private DAILY_AVERAGE_BLOCK = 7152;
    address private ETH_TOKEN_PLACEHOLDER = 0x0000000000000000000000000000000000000000;

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

    // map(invoiceCreator, invoicePayer, invoiceIdx) -> balance
    mapping (address => mapping(address => mapping(uint => euint128))) balances;

    enum InvoiceStatus {
        Created,
        Accepted,
        Cancelled,
        Completed
    }

    // maps creator address and invoice Idx to an invoice
    mapping (address => mapping (uint128 => Invoice) ) InvoicesByCreatorAddressAndInvoiceIdx;

    // maps payer address and invoice Idx to an invoice
    mapping (address => mapping (uint128 => Invoice) ) InvoicesByPayerAddressAndInvoiceIdx;

    // maps invoice Idx to an invoice
    mapping (uint128 => Invoice) InvoicesByIdx;

    event Initialized();
    event InvoiceCreated(uint128 invoiceIdx, address creator, uint128 amount, address validPaymentToken);
    event InvoiceAccepted(uint128 invoiceIdx, address payer, uint128 amount, address validPaymentToken);
    event PaymentCanceled(uint128 invoiceIdx, address creator, address payer);
    event PaymentWithdrawn(uint128 invoiceIdx);
    event InvoiceCompleted(uint128 invoiceIdx);
    event EthRecieved(uint256 amount);

    constructor() {
        currentInvoiceIdx = 0;
        defaultCriticalPeriod = DAILY_AVERAGE_BLOCK * 7;

        emit Initialized();
    }

    receive() external payable{
        emit EthRecieved(msg.value);
    }

    /// @notice Create an invoice
    /// @dev Append created invoice to Storage maps
    /// @param _amount amount of token to pay for each invoice payment
    /// @param _recurrent boolean for recurrent payment
    /// @param _numberOfRecurrentPayment number of recurrent payment; >=1
    /// @param _recurrentPaymentInterval payment intervals in block number
    /// @param _criticalPeriod critical period in block number
    /// @param _validPaymentToken  valid payment token
    /// @param _payers authorized payers
    /// @return invoiceIdx
    function createInvoice(
        uint128 _amount, 
        bool _recurrent, 
        uint128 _numberOfRecurrentPayment, 
        uint128 _recurrentPaymentInterval,
        uint128 _criticalPeriod,
        address _validPaymentToken, 
        address[] memory _payers
    ) external returns (uint128 invoiceIdx) {
        // verify invoice creator is not payer
        uint256 len = _payers.length;
        for(uint256 i = 0; i < len; i++ ){
            require(_payers[i] != msg.sender, "Sisan::acceptInvoice::Creator can not be payer");
        }

        // minimal critical period for conflict resolution must be > 7 days
        require(_criticalPeriod >= defaultCriticalPeriod, 
            "Sisan::acceptInvoice::Critical period must be at least 7 days"
        );

        // construct incoice from parameters
        Invoice memory invoice = Invoice({
            invoiceIdx: currentInvoiceIdx,
            amount: _amount,
            criticalPeriod: uint128(block.number) + _criticalPeriod,
            creator: msg.sender,
            payers: _payers,
            recurrent: _recurrent,
            numberOfRecurrentPayment: int128(_numberOfRecurrentPayment),
            recurrentPaymentInterval: _recurrentPaymentInterval,
            validPaymentToken: _validPaymentToken,
            lastWithdrawal: uint128(block.number),
            status: InvoiceStatus.Created
        });

        // update storage
        InvoicesByCreatorAddressAndInvoiceIdx[invoice.creator][invoice.invoiceIdx] = invoice;
        InvoicesByIdx[invoice.invoiceIdx] = invoice;
        currentInvoiceIdx++;

        // emit event for indexing
        emit InvoiceCreated(invoiceIdx, msg.sender, _amount, _validPaymentToken);

        // return invoice index
        return invoice.invoiceIdx;
    }

    /// @notice Accepts an invoice
    /// @dev Receive payment to cover for invoice payment.
    /// @param invoiceIdx invoice index.
    /// @param recurrent boolean for recurrent invoice payment. Must match invoice. 
    function acceptInvoice(
        uint128 invoiceIdx,
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

        require(isValidPayer, "Sisan::acceptInvoice::Only valid payer can accept payment");

        // update invoice status
        invoice.status = InvoiceStatus.Accepted;

        // add invoice to payer map
        InvoicesByPayerAddressAndInvoiceIdx[msg.sender][invoiceIdx] = invoice;

        // update storage
        InvoicesByIdx[invoiceIdx] = invoice;

        // update balance
        uint128 _tempProduct = uint128(invoice.amount) * uint128(invoice.numberOfRecurrentPayment);
        euint128 _newBalance = FHE.asEuint128(uint128(_tempProduct));
        balances[invoice.creator][msg.sender][invoice.invoiceIdx] = _newBalance;

        // verify attached ether
        if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
            if(invoice.recurrent) {
                uint128 attachedAmmount = uint128(msg.value) * uint128(invoice.numberOfRecurrentPayment);
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
                uint128 requiredAmmount = invoice.amount * uint128(invoice.numberOfRecurrentPayment);
                require(requiredAmmount == allowance, "Sisan::acceptInvoice::Insufficient allowance");
                token.transferFrom(msg.sender, address(this), requiredAmmount);
            } else {
                require(invoice.amount == allowance,  "Sisan::acceptInvoice::Insufficient token attached"); 
                token.transferFrom(msg.sender, address(this), allowance);      
            }
        }

        emit InvoiceAccepted(invoiceIdx, msg.sender, invoice.amount, invoice.validPaymentToken);
    }

    /// @notice Cancel payment on an invoice
    /// @dev transfer funds to payer and payee based on critical period
    /// @param invoiceIdx invoice index
    function cancelPayment(
        uint128 invoiceIdx
    ) payable external nonReentrant {
        Invoice memory invoice = InvoicesByIdx[invoiceIdx]; 

        // ensure caller is a valid payer
        uint256 len = invoice.payers.length;
        bool isValidPayer = false;

        for(uint128 i = 0; i < len; i++){
            if(invoice.payers[i] == msg.sender) {
                isValidPayer = true;
            }
        } 

        require(isValidPayer, "Sisan::cancelPayment::Only valid payer can cancel payment");

        // if one to many pop out canceled payer from array
        if(len > 1) {
            for(uint128 i = 0; i < len; i++) {
                if(invoice.payers[i] == msg.sender) {
                    delete invoice.payers[i];
                } 
            }
        }

        // update state to Created if one to one invoice
        if(invoice.payers[0] == address(0)) {
            invoice.status = InvoiceStatus.Cancelled;
        }
        InvoicesByIdx[invoiceIdx] = invoice; 

        // // withdraw outstanding payment
        withdrawOutstandingPayment(invoiceIdx, invoice.creator, msg.sender);

        // update balance 
        balances[invoice.creator][msg.sender][invoice.invoiceIdx] = FHE.asEuint128(0);

        if(block.number > invoice.criticalPeriod) {
            // transfer 50% of payment to payer and 50% to payee

            // if payment is recurrent
            // transfer amount * number of payment not withdrawn - (amount/2)
            if (invoice.numberOfRecurrentPayment > 0) {
                uint128 numberOfRecurrentPaymentLeft = uint128(invoice.numberOfRecurrentPayment);
                uint128 _balanceLeft = (numberOfRecurrentPaymentLeft * invoice.amount) - (invoice.amount/2);
                
                // check if valid token is eth
                // if true, transfer 50% of amout to payee and the rest to payer
                if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                    payable(msg.sender).transfer(_balanceLeft);
                    payable(invoice.creator).transfer(invoice.amount/2);
                }

                // check if valid token is erc29 token
                // if true, transfer 50% of amout to payee and the rest to payer
                if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
                    IERC20 token = IERC20(invoice.validPaymentToken);

                    token.transfer(msg.sender, _balanceLeft);
                    token.transfer(invoice.creator, invoice.amount/2);
                }     
            }else {
                // check if valid token is eth
                // if true, transfer 50% of amout to payee and the rest to payer
                if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                    payable(msg.sender).transfer(invoice.amount/2);
                    payable(invoice.creator).transfer(invoice.amount/2);
                }

                // check if valid token is erc29 token
                // if true, transfer 50% of amout to payee and the rest to payer
                if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
                    IERC20 token = IERC20(invoice.validPaymentToken);

                    token.transfer(msg.sender, invoice.amount/2);
                    token.transfer(invoice.creator, invoice.amount/2);
                }     
            }
        }else {
            // transfer 100% to payer

            // if payment is recurrent
            // transfer amount * number of payment not withdrawn 
            if (invoice.numberOfRecurrentPayment > 0) {
                uint128 numberOfRecurrentPaymentLeft = uint128(invoice.numberOfRecurrentPayment);
                uint128 _balanceLeft = (numberOfRecurrentPaymentLeft * invoice.amount);

                // check if valid token is eth
                // if true, transfer 100% to payer
                if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                    payable(msg.sender).transfer(_balanceLeft);
                }

                // check if valid token is eth
                // if true, transfer 100% to payer
                if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
                    IERC20 token = IERC20(invoice.validPaymentToken);
                    token.transfer(msg.sender, _balanceLeft);
                }
            }else {
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
        }

        // emit event for indexing
        emit PaymentCanceled(invoice.invoiceIdx, invoice.creator, msg.sender);
    }

    /// @notice Withdraw payment on an invoice
    /// @dev Withdraws all payment since last withdraw
    /// @param invoiceIdx invoice index
    /// @param payer payer of the invoice
    function withdrawPayment(
        uint128 invoiceIdx,
        address payer
    ) public nonReentrant {
        Invoice memory invoice = InvoicesByIdx[invoiceIdx]; 

        require(invoice.creator == msg.sender, 
            "Sisan::withdrawPayment::Only valid creator can withdraw payment"
        );

        require(block.number > invoice.criticalPeriod, 
            "Sisan::withdrawPayment::Can only withdraw after critical period"
        );

        require(invoice.status == InvoiceStatus.Accepted, 
            "Sisan::withdrawPayment::Invoice not accepted"
        );
        
        uint128 _balanceTemp = FHE.decrypt(balances[invoice.creator][payer][invoice.invoiceIdx]);
        require(_balanceTemp > 0,
            "Sisan::withdrawPayment::Invoice payment complete"
        );

        if(invoice.validPaymentToken != ETH_TOKEN_PLACEHOLDER) {
            IERC20 token = IERC20(address(invoice.validPaymentToken));

            require(token.balanceOf(address(this)) >= invoice.amount,
                "Sisan::withdrawPayment::Insufficint token balance in contract"
            );
        }


        // if payment is recurrent, check how many payment is left to be withdrawn
        // transfer amount * number of payment not withdrawn
        if (invoice.numberOfRecurrentPayment > 1) {
            uint128 lasWithdrawalPeriod = uint128(block.number) - invoice.lastWithdrawal;
            uint128 missedPaymentWithdrawal = lasWithdrawalPeriod/invoice.recurrentPaymentInterval;

            uint128 amountToTransfer = missedPaymentWithdrawal * invoice.amount;

            // update balance
            euint128 oldBalance = balances[invoice.creator][payer][invoice.invoiceIdx];
            balances[invoice.creator][payer][invoice.invoiceIdx] = FHE.sub(oldBalance, FHE.asEuint128(amountToTransfer));
            invoice.lastWithdrawal = uint128(block.number);


            // update payment remaining
            invoice.numberOfRecurrentPayment = invoice.numberOfRecurrentPayment - int128(missedPaymentWithdrawal);

            if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                payable(msg.sender).transfer(amountToTransfer);
            } else {
                IERC20 token = IERC20(invoice.validPaymentToken);
                token.transfer(msg.sender, amountToTransfer);
            }
        }

        // if payment is not recurrent, transfer single payment 
        if(invoice.numberOfRecurrentPayment <= 1) {
            euint128 oldBalance = balances[invoice.creator][payer][invoice.invoiceIdx];

            // update balance
            balances[invoice.creator][payer][invoice.invoiceIdx] = FHE.sub(oldBalance, FHE.asEuint128(invoice.amount));
            invoice.lastWithdrawal = uint128(block.number);

            // update payment remaining
            invoice.numberOfRecurrentPayment = invoice.numberOfRecurrentPayment - 1;

            if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
                payable(msg.sender).transfer(invoice.amount);
            } else {
                IERC20 token = IERC20(invoice.validPaymentToken);
                token.transfer(msg.sender, invoice.amount);
            }            

            invoice.status = InvoiceStatus.Completed;
            emit InvoiceCompleted(invoice.invoiceIdx);
        }

        emit PaymentWithdrawn(invoice.invoiceIdx);
    }

    function getInvoice(
        uint128 invoiceIdx
    ) view external returns(Invoice memory invoice) {
        return InvoicesByIdx[invoiceIdx];
    }

    function getInvoiceBalance(
        address creator,
        address payer,
        uint128 invoiceIdx
    ) view external returns(uint balance) {
        return FHE.decrypt(balances[creator][payer][invoiceIdx]);
    }

    function getInvoiceByCreatorAndIdx(
        address creator,
        uint128 invoiceIdx
    ) view external returns(Invoice memory invoice) {
        return InvoicesByCreatorAddressAndInvoiceIdx[creator][invoiceIdx];
    }

    function getInvoiceByPayerAndIdx(
        address payer,
        uint128 invoiceIdx
    ) view external returns(Invoice memory invoice) {
        return InvoicesByPayerAddressAndInvoiceIdx[payer][invoiceIdx];
    }

    function withdrawOutstandingPayment(
        uint128 invoiceIdx, 
        address invoiceCreator, 
        address invoicePayer
    ) internal {
        Invoice memory invoice = InvoicesByIdx[invoiceIdx]; 
        uint128 missedPaymentWithdrawal;

        if (invoice.recurrentPaymentInterval > 0) {
            uint128 lasWithdrawalPeriod = uint128(block.number) - invoice.lastWithdrawal;
            missedPaymentWithdrawal = lasWithdrawalPeriod/invoice.recurrentPaymentInterval;
        }else {
            missedPaymentWithdrawal = 1;
        }
        
        uint128 amountToTransfer = missedPaymentWithdrawal * invoice.amount;

        // update balance
        euint128 oldBalance = balances[invoiceCreator][invoicePayer][invoiceIdx];
        balances[invoiceCreator][invoicePayer][invoice.invoiceIdx] = FHE.sub(oldBalance, FHE.asEuint128(amountToTransfer));
        invoice.lastWithdrawal = uint128(block.number);

        // update payment remaining
        invoice.numberOfRecurrentPayment = invoice.numberOfRecurrentPayment - int128(missedPaymentWithdrawal);

        if(invoice.validPaymentToken == ETH_TOKEN_PLACEHOLDER) {
            payable(msg.sender).transfer(amountToTransfer);
        } else {
            IERC20 token = IERC20(invoice.validPaymentToken);
            token.transfer(msg.sender, amountToTransfer);
        }
    }
}
