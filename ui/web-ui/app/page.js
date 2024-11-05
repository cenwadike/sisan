
import '../app/globals.css'
import Head from '@/components/Head'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Home from './home'
import DashBoard from '@/components/Dashboard'

export default function Page(){

  return (
    <>
      <Head />
      <Navbar />
      <Home />
      <DashBoard />
      <Footer />
    </>
  )
}
