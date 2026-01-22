import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import brand from "../../data/brand.json";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./CustomerForms.css";


export default function CustomerForms() {

	const brand = useContext(BrandContext);

  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
            Customer Forms
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='text-main mb-3'>
              Download commonly requested forms below.
            </div>

            <div className='row g-3'>
              <div className='col-12'>
                <a className='text-decoration-none text-main' href='/forms/credit-app.pdf' target='_blank' rel='noreferrer'>
                  • Credit Application (PDF)
                </a>
              </div>
              <div className='col-12'>
                <a className='text-decoration-none text-main' href='/forms/tax-exempt.pdf' target='_blank' rel='noreferrer'>
                  • Tax Exempt Form (PDF)
                </a>
              </div>
              <div className='col-12'>
                <a className='text-decoration-none text-main' href='/forms/new-account.pdf' target='_blank' rel='noreferrer'>
                  • New Account Setup (PDF)
                </a>
              </div>
            </div>

            <div className='text-muted small mt-4'>
              Send any and all completed forms to <span className='fw-bold'>{brand.email}</span> or drop them off at our location.
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}
