import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./CustomerForms.css";

const FORM_DOWNLOADS = [
  {
    id: "credit-app",
    title: "Credit Application",
    copy: "Apply for account terms or update your business billing information.",
    fileName: "ihi-credit-application.pdf",
    href: "/forms/ihi-credit-application.pdf",
    icon: "bi-file-earmark-person",
  },
  {
    id: "tax-exempt",
    title: "Tax Exempt Form",
    copy: "Submit your resale or exemption information for account review.",
    fileName: "ihi-tax-exempt-form.pdf",
    href: "/forms/ihi-tax-exempt-form.pdf",
    icon: "bi-file-earmark-check",
  },
  {
    id: "new-account",
    title: "New Account Setup",
    copy: "Send us your company details so we can create or update your customer profile.",
    fileName: "ihi-new-account-setup.pdf",
    href: "/forms/ihi-new-account-setup.pdf",
    icon: "bi-file-earmark-plus",
  },
];

export default function CustomerForms() {
  const brand = useContext(BrandContext);

  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-0 ps-sm-4'>
            Customer Forms
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='row align-items-end g-3 mb-4'>
              <div className='col-12 col-lg-8'>
                <div className='text-main fs-5 mb-2'>Download commonly requested forms.</div>
                <div className='text-muted'>
                  Fill out the PDF you need, then email it back or bring it with you to the store.
                </div>
              </div>
              <div className='col-12 col-lg-4 text-lg-end'>
                <a className='customer-forms-email text-main fw-semibold text-decoration-none' href={`mailto:${brand.email}`}>
                  {brand.email}
                </a>
              </div>
            </div>

            <div className='row g-3'>
              {FORM_DOWNLOADS.map((form) => (
                <div key={form.id} className='col-12 col-lg-4'>
                  <div className='customer-form-card h-100 rounded-4 p-4 d-flex flex-column'>
                    <div className='d-flex align-items-start gap-3 mb-3'>
                      <div className='customer-form-icon rounded-3 d-flex align-items-center justify-content-center'>
                        <i className={`bi ${form.icon}`} />
                      </div>
                      <div>
                        <div className='text-main text-uppercase fw-semibold'>{form.title}</div>
                        <div className='small text-muted mt-1'>{form.fileName}</div>
                      </div>
                    </div>

                    <p className='text-muted flex-grow-1 mb-4'>{form.copy}</p>

                    <div className='d-flex flex-column flex-sm-row gap-2'>
                      <a
                        className='btn-main-cta customer-form-btn rounded-3 text-uppercase text-main-light text-center text-decoration-none py-2 px-3'
                        href={form.href}
                        download>
                        Download PDF
                      </a>
                      <a
                        className='btn-secondary-cta customer-form-btn rounded-3 text-uppercase text-main text-center text-decoration-none py-2 px-3'
                        href={form.href}
                        target='_blank'
                        rel='noreferrer'>
                        Preview
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className='customer-forms-note rounded-4 p-3 mt-4 small text-muted'>
              Completed forms can be sent to <span className='fw-bold text-main'>{brand.email}</span> or dropped off at our location.
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}
