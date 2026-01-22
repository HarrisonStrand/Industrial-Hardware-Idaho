import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./VendorInformation.css";

export default function VendorInformation() {
  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
            Vendor Information
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='text-main mb-3'>
              Interested in becoming a vendor or supplier? We’re always looking for quality product lines.
            </div>

            <div className='row g-3'>
              <div className='col-12 text-main'>
                Please send:
                <ul className='legal-list mt-2'>
                  <li>Company overview and contact info</li>
                  <li>Line card / catalog</li>
                  <li>Pricing structure and terms</li>
                  <li>Minimums, lead times, and freight details</li>
                  <li>Warranty, compliance, and certifications (if applicable)</li>
                </ul>
              </div>

              <div className='col-12 text-main'>
                For the fastest review, use the Contact page and select “Vendor Inquiry” in the subject.
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}
