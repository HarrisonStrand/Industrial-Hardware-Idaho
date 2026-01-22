import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Legal.css";

export default function TermsConditions() {
  const brand = useContext(BrandContext);

  const BRAND = brand?.brandName || "";
  const LEGAL = brand?.legalEntityName || "";
  const WEBSITE = brand?.websiteUrl || "";
  const EMAIL = brand?.supportEmail || "";

  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
            Terms & Conditions
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='row m-0'>
              <div className='legal-copy text-main'>
                <p className='mb-3'>
                  These Terms & Conditions govern your use of the{" "}
                  <span className='fw-semibold'>{BRAND}</span> website
                  {WEBSITE ? (
                    <>
                      {" "}
                      (<span className='fw-semibold'>{WEBSITE}</span>)
                    </>
                  ) : null}
                  . The site is operated by <span className='fw-semibold'>{LEGAL}</span>.
                  By accessing or purchasing from our site, you agree to these terms.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Orders & acceptance</h5>
                <ul className='legal-list'>
                  <li>Orders are offers to purchase and are subject to acceptance.</li>
                  <li>
                    We may cancel or limit quantities for any reason, including suspected fraud or
                    inventory constraints.
                  </li>
                  <li>
                    Product images and descriptions are provided for convenience; confirm specs and
                    compatibility before ordering.
                  </li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Pricing & availability</h5>
                <ul className='legal-list'>
                  <li>Prices and availability may change without notice.</li>
                  <li>We are not responsible for typographical pricing errors.</li>
                  <li>
                    If a pricing error occurs, we may cancel the order and notify you.
                  </li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Payments</h5>
                <p className='mb-3'>
                  Payments are processed by third-party providers. You agree to provide accurate
                  billing information and authorize charges for your order.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Tax & tax-exempt orders</h5>
                <p className='mb-3'>
                  Sales tax may be applied where required. If you are tax-exempt, you may need to
                  provide documentation before tax exemption is applied to your account or order.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Shipping & delivery</h5>
                <ul className='legal-list'>
                  <li>Delivery dates are estimates and not guaranteed.</li>
                  <li>Risk of loss typically passes upon carrier pickup (unless required otherwise by law).</li>
                  <li>
                    Some items may ship separately; backordered items may ship when available.
                  </li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Returns</h5>
                <p className='mb-3'>
                  Returns are governed by our Returns & Exchanges policy. Certain items may be
                  non-returnable (e.g., special orders, cut-to-length, clearance, or used items).
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Account responsibility</h5>
                <ul className='legal-list'>
                  <li>You are responsible for maintaining account confidentiality.</li>
                  <li>You agree to notify us of any unauthorized account use.</li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Prohibited use</h5>
                <ul className='legal-list'>
                  <li>Using the site for unlawful purposes.</li>
                  <li>Attempting to gain unauthorized access to systems or accounts.</li>
                  <li>Interfering with site operations, scraping, or abuse of services.</li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Disclaimers</h5>
                <p className='mb-3'>
                  The site and products are provided “as is” to the fullest extent permitted by law.
                  We disclaim warranties of merchantability, fitness for a particular purpose, and
                  non-infringement where permitted.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Limitation of liability</h5>
                <p className='mb-3'>
                  To the fullest extent permitted by law, <span className='fw-semibold'>{BRAND}</span>{" "}
                  and <span className='fw-semibold'>{LEGAL}</span> are not liable for indirect,
                  incidental, special, consequential, or punitive damages, or lost profits, arising
                  from use of the site or products.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Changes</h5>
                <p className='mb-3'>
                  We may update these Terms from time to time. Continued use of the site after
                  changes means you accept the updated terms.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Contact</h5>
                <p className='mb-0'>
                  Questions about these Terms? Contact{" "}
                  <span className='fw-semibold'>{BRAND}</span>
                  {EMAIL ? (
                    <>
                      {" "}
                      at <span className='fw-semibold'>{EMAIL}</span>
                    </>
                  ) : null}
                  .
                </p>

                <p className='text-muted small mt-3 mb-0'>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}
