"use client"
import Link from "next/link";
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from "react";

import Sisan from "../../../on-chain/artifacts/contracts/Sisan.sol/Sisan.json";
import truncateEthAddress from "truncate-eth-address";
const sisanAddress = "0x203cdb9736B57B080D68cb88739C155bC95CbE4f";

// dashboard allow creating invoices
// dashboard display all of payee invoices
export default function DashBoard() {
  const [userData, setUserData] = useState([]);
  const [loading, setLoading] = useState("loading");
  const [showModal, setShowModal] = useState(false);
  const [createInvoiceInput, setCreateInvoiceInput] = useState({
    amount: "", 
    recurrent: Boolean, 
    numberOfRecurrentPayment: "", 
    recurrentPaymentInterval: "",
    criticalPeriod: "",
    validPaymentToken: "", 
    payers: [],
  });
  const router = useRouter();

  useEffect(() => {
    loadData().then(setLoading("loaded"));
  }, []);

  //////////////////////////////////load invoice from blockchain
  async function loadData() {
    const web3Modal = new Web3Modal()
    const connection = await web3Modal.connect()
    const provider = new ethers.providers.Web3Provider(connection)    
    const signer = provider.getSigner()

    console.log("signer: ", signer);
    const sisanContract = new ethers.Contract(sisanAddress, Sisan.abi, signer);
    const currentInvoiceIdx = await sisanContract.currentInvoiceIdx()
    console.log("currentInvoiceIdx: ", parseInt(currentInvoiceIdx));

    let data = [];
    if (currentInvoiceIdx !== 0) {
      for (let i = 0; i < currentInvoiceIdx; i++) {
        try {
          const temp = await sisanContract.getInvoice(i);
          data.push(temp)
        } catch (error) {
          console.error("Failed to load data with error: ", error)
        }
      }

      console.log("batch data: ", data)
      const uData = await Promise.all(
        data.map(async (i) => {
          let invoiceIdx = parseInt(i.invoiceIdx);
          let amount = ethers.utils.formatUnits(i.amount.toString(), "ether");
          let criticalPeriod = parseInt(i.criticalPeriod);
          let creator = i.creator;
          let payer = i.payers[0];
          let recurrent = i.recurrent === true ? "True" : "False";
          let numberOfRecurrentPayment = parseInt(i.numberOfRecurrentPayment);
          let recurrentPaymentInterval = parseInt(i.recurrentPaymentInterval);
          let validPaymentToken = i.validPaymentToken;
          let lastWithdrawal = i.lastWithdrawal;
          
          let status;
          switch (i.itemState) {
            case 0:
              status = "Unpaid";
              break;
            case 1:
              status = "Accepted";
              break;
            case 2:
              status = "Cancelled";
              break;
            case 3:
              status = "Paid";
              break;
            default:
              status = "NaN";
          }

          let tempUData = {
            invoiceIdx,
            amount,
            criticalPeriod,
            creator,
            payer,
            recurrent,
            numberOfRecurrentPayment,
            recurrentPaymentInterval,
            validPaymentToken,
            lastWithdrawal,
            status,
          }

          return tempUData;
        })
      )

      console.log("u data: ", uData[0]);

      setUserData(uData);
      // userData.push(uData);
      console.log("data: ", userData);
    }
  }

  ////////////////////////////////add new invoice to chain
  async function createInvoice() {
    const { 
      amount, 
      recurrent, 
      numberOfRecurrentPayment, 
      recurrentPaymentInterval,
      criticalPeriod,
      validPaymentToken, 
      payers,
    } = createInvoiceInput;

    if (
      !amount || 
      !recurrent || 
      !numberOfRecurrentPayment || 
      !recurrentPaymentInterval || 
      !criticalPeriod || 
      !validPaymentToken || 
      !payers
    ){
      return;
    }

    const web3Modal = new Web3Modal()
    const connection = await web3Modal.connect()
    const provider = new ethers.providers.Web3Provider(connection)    
    const signer = provider.getSigner()
    const sisanContract = new ethers.Contract(sisanAddress, Sisan.abi, signer);

    const amountAsEther = ethers.utils.parseUnits(amount, "ether");
    const criticalPeriodAsBlocks = criticalPeriod * 7152;
    const recurrentAsBool = recurrent === "False" || "F" ? false : true

    await sisanContract.createInvoice(
      amountAsEther, 
      recurrentAsBool, 
      numberOfRecurrentPayment, 
      recurrentPaymentInterval,
      criticalPeriodAsBlocks,
      validPaymentToken, 
      [payers]
    );

    setShowModal(false);
    router.push("/");
  }

  //////////////////////////////////display invoices
  if (loading == "loaded") {
    return (
      <div className="bg-white">
        <div className='pt-12 text-2xl md:text-4xl text-blue-800 font-bold mb-12'>
          <div className='p-4'>
            <h2 className='text-2xl font-bold uppercase py-2 md:px-16'>Invoices</h2>
            <div className='grid justify-items-stretch sm:grid-cols-2 gap-4 pt-4'>
              {userData.map(data => 
                <div key={data.invoiceIdx} className='border shadow rounded-xl overflow-hidden'>
                  <div className='p-4 flex justify-center bg-blue-800 border-t border-solid border-slate-200'>
                    <p className='text-xl font-small text-white'>Creator - {truncateEthAddress(data.creator)}</p>
                  </div>
                  <div className='p-4 flex justify-center bg-blue-800 border-t border-solid border-slate-200'>
                    <p className='text-xl font-small text-white'>Payer - {truncateEthAddress(data.payer)}</p>
                  </div>
                  <div className='p-4 flex justify-center bg-blue-800 border-t border-solid border-slate-200'>
                    <p className='text-xl font-small text-white'>Invoice ID - {data.invoiceIdx}</p>
                  </div>
                  <div className='p-4 flex justify-center bg-blue-800 border-t border-solid border-slate-200'>
                    <p className='text-xl font-small text-white'>Amount - {data.amount}</p>
                  </div>
                  <div className='p-4 flex justify-center bg-blue-800 border-t border-solid border-slate-200'>
                    <p className='text-xl font-small text-white'>Valid Token - {truncateEthAddress(data.validPaymentToken)}</p>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
        {/* createInvoice modal */}
        <div className='flex justify-center p-5'>
          <button
            className='text-white font-bold uppercase text-sm px-6 py-3 rounded shadow bg-blue-600 hover:bg-blue-900 hover:shadow-lg hover:px-8 outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-300'
            type='button'
            onClick={() => setShowModal(true)}>
            create invoice
          </button>
          {showModal ? (
            <>
              <div className='justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none'>
                <div className='relative w-auto my-6 mx-auto max-w-3xl'>
                  {/*content*/}
                  <div className='border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-blue-900 outline-none focus:outline-none'>
                    {/*header*/}
                    <div className='flex items-center justify-between p-5 border-b border-solid border-slate-200 rounded-t text-white'>
                      <h3 className='text-3xl font-semibold text-center uppercase pl-12'>
                        create invoice
                      </h3>
                      <button
                        className='p-1 ml-auto bg-transparent border-0 text-white opacity-5 float-right text-3xl leading-none font-semibold outline-none focus:outline-none'
                        onClick={() => setShowModal(false)}>
                        <span className='bg-transparent text-white opacity-5 h-6 w-6 text-2xl block outline-none focus:outline-none'>
                          ×
                        </span>
                      </button>
                    </div>
                    {/*body*/}
                    <div className='relative p-6 pb-0 flex-auto'>
                      <div className='px-4 flex justify-center'>
                        <form className='w-full max-w-sm'>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='inline-full-name'>
                                  Amount
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='amount'
                                type='text'
                                placeholder='10'
                                onChange={(e) =>
                                  setCreateInvoiceInput({ ...createInvoiceInput, amount: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='inline-full-name'>
                                Recurrent      
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='recurrent'
                                type='text'
                                placeholder='True'
                                onChange={(e) =>
                                  setCreateInvoiceInput({ ...createInvoiceInput, recurrent: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='inline-full-name'>
                                Number Of Recurrent Payment
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='number_of_recurrent_payment'
                                type='text'
                                placeholder='2'
                                onChange={(e) =>
                                  setCreateInvoiceInput({
                                    ...createInvoiceInput,
                                    numberOfRecurrentPayment: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='inline-full-name'>
                                Payment Interval(Days)
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='recurrent_payment_interval'
                                type='text'
                                placeholder='30'
                                onChange={(e) =>
                                  setCreateInvoiceInput({
                                    ...createInvoiceInput,
                                    recurrentPaymentInterval: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='inline-full-name'>
                                Critical Period(Days)
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='critical_period'
                                type='text'
                                placeholder='15'
                                onChange={(e) =>
                                  setCreateInvoiceInput({ ...createInvoiceInput, criticalPeriod: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='valid_token'>
                                  Valid Payment Token(Address)
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='price'
                                type='text'
                                placeholder='0x123...'
                                onChange={(e) =>
                                  setCreateInvoiceInput({ ...createInvoiceInput, validPaymentToken: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className='md:flex md:items-center mb-6'>
                            <div className='md:w-1/3'>
                              <label
                                className='block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4'
                                htmlFor='payer'>
                                  Payer(Address)
                              </label>
                            </div>
                            <div className='md:w-2/3'>
                              <input
                                className='bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500'
                                id='price'
                                type='text'
                                placeholder='0xabc...'
                                onChange={(e) =>
                                  setCreateInvoiceInput({ ...createInvoiceInput, payers: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                    {/*footer*/}
                    <div className='flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b'>
                      <button
                        className='text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150'
                        type='button'
                        onClick={() => setShowModal(false)}>
                        Close
                      </button>
                      <Link href='/'>
                        <div>
                          <button
                            className='bg-emerald-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-0 ease-linear transition-all duration-150'
                            type='button'
                            onClick={createInvoice}>
                            create invoice
                          </button>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className='opacity-60 fixed inset-0 z-40 bg-blue-900'></div>
            </>
          ) : null}
        </div>
      </div>
    );
  }
}
