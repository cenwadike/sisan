"use client"

import Link from "next/link";
import { ethers } from "ethers";
import { createPopper } from "@popperjs/core";
import Web3Modal from "web3modal";
import truncateEthAddress from 'truncate-eth-address'
import { useState, useEffect, createRef } from "react";

export default function Navbar() {
  ////////////////////////////////metamask state
  const [userAccount, setUserAccount] = useState(null);

  ////////////////////////////////metamask state handlers
  const connectWalletHandler = () => {
    try {
      MetaMaskClientCheck();
    } catch (error) {
      console.log(error);
      return;
    }
  };

  const isMetaMaskInstalled = () => {
    const { ethereum } = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  };

  const MetaMaskClientCheck = () => {
    if (!isMetaMaskInstalled()) {
      return <button onClick={onClickInstallMetamask}> click here to install MetaMask</button>;
    } else {
      try {
        onClickConnectMetamask();
      } catch (error) {
        console.log(error);
      }
    }
  };

  const onClickInstallMetamask = () => {
    return;
  };

  const onClickConnectMetamask = async () => {
    try {
      // await ethereum.request({ method: "eth_requestAccounts" });
      const result = await ethereum.request({ method: "eth_accounts" });
      console.log("result: ", result);
      accountChangeHandler(result[0]);
    } catch (error) {
      console.error(error);
    } finally {
      const web3Modal = new Web3Modal()
      const connection = await web3Modal.connect()      
      const provider = new ethers.providers.Web3Provider(connection) 
      provider.getNetwork().then((result) => {
      });
    }
  };

  const accountChangeHandler = (newAccount) => {
    setUserAccount(newAccount);
  };

  const chainChangedHandler = () => {
    // reload the page to avoid any errors with chain change mid use of application
    window.location.reload();
  };

  // listen for account changes
  useEffect(() => {
    const { ethereum } = window;
    ethereum.on("chainChanged", () => {
      chainChangedHandler();
    });
    ethereum.on("accountsChanged", () => {
      accountChangeHandler;
    });
  });

  useEffect(() => {
    onClickConnectMetamask()
  }, []);

  ////////////////////////////////hamburger state
  const [active, setActive] = useState(false);

  ////////////////////////////////hamburger state handler
  const handleClick = () => {
    setActive(!active);
  };

  ////////////////////////////////dropdown state
  const [dropdownPopoverShow, setDropdownPopoverShow] = useState(false);
  const [roleButtonText, setRoleButtonText] = useState("Role");
  const btnDropdownRef = createRef();
  const popoverDropdownRef = createRef();

  ////////////////////////////////dropdown state handler
  const openDropdownPopover = () => {
    createPopper(btnDropdownRef.current, popoverDropdownRef.current, {
      placement: "bottom-start",
    });
    setDropdownPopoverShow(true);
  };
  const closeDropdownPopover = () => {
    setDropdownPopoverShow(false);
  };

  return (
    <>
      <nav className='fixed w-full flex items-center flex-wrap bg-white px-6 md:px-20 py-2 navbar-expand-lg shadow-md'>
        <Link href='/'>
          <div className='inline-flex items-center p-2 mr-0'>
            <span className='text-2xl text-blue-800 hover:text-blue-900 font-bold uppercase tracking-wide'>
              Sisan
            </span>
          </div>
        </Link>
        <button
          className=' inline-flex p-3 hover:bg-blue-900 rounded lg:hidden text-blue-800 ml-auto hover:text-white outline-none'
          onClick={handleClick}>
          <i className='fas fa-bars'></i>
        </button>
        {/*Note that in this div we will use a ternary operator to decide whether or not to display the content of the div  */}
        <div className={`${active ? "" : "hidden"}  w-full lg:inline-flex lg:flex-grow lg:w-auto`}>
          <div className='lg:inline-flex lg:flex-row lg:ml-auto lg:w-auto w-full lg:items-center items-start flex flex-col lg:h-auto'>
            <button
              className='p-2 lg:px-4 md:mx-2 text-blue-700 text-center border border-transparent rounded hover:bg-indigo-300 hover:text-indigo-800 transition-colors duration-300 inline-flex items-center'
              type='button'
              data-dropdown-toggle='dropdown'
              ref={btnDropdownRef}
              onClick={() => {
                dropdownPopoverShow ? closeDropdownPopover() : openDropdownPopover();
              }}>
              {roleButtonText}
              <svg
                className='w-4 h-4 ml-2'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M19 9l-7 7-7-7'></path>
              </svg>
            </button>
            <div
              ref={popoverDropdownRef}
              className={
                dropdownPopoverShow
                  ? "block "
                  : "hidden " + "text-base z-50 float-left py-2 list-none text-left shadow-lg mt-1"
              }
              style={{ minWidth: "12rem" }}>
              <Link href='/'>
                <div
                  className={
                    "text-sm py-2 px-4 font-normal block w-full whitespace-nowrap text-white hover:text-indigo-300 bg-blue-900 border-0"
                  }
                  onClick={() => setRoleButtonText("Payer")}>
                  payer
                </div>
              </Link>
              <Link href='/'>
                <div
                  className={
                    "text-sm py-2 px-4 font-normal block w-full whitespace-nowrap text-white hover:text-indigo-300 bg-blue-900 border-0"
                  }
                  onClick={() => setRoleButtonText("Payee")}>
                  payee
                </div>
              </Link>
            </div>
            <Link href='/'>
              <button
                onClick={connectWalletHandler}
                className='p-2 lg:px-4 md:mx-2 bg-indigo-300 text-blue-700 text-center border border-transparent rounded hover:bg-indigo-900 hover:text-indigo-700 transition-colors duration-300'>
                {userAccount ? truncateEthAddress(userAccount) : "connect wallet"}
              </button>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
