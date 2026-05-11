const TOYYIBPAY_BASE_URL = "https://toyyibpay.com";

export async function createBill(params: {
  orderId: number;
  productName: string;
  amount: number;
  customerName: string;
  callbackUrl: string;
  returnUrl: string;
}): Promise<string | null> {
  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;

  if (!secretKey || !categoryCode) {
    throw new Error("TOYYIBPAY_SECRET_KEY or TOYYIBPAY_CATEGORY_CODE not set");
  }

  const amountInCents = Math.round(params.amount * 100);

  const billName = `Order${params.orderId}`.replace(/[^a-zA-Z0-9_ ]/g, "").slice(0, 30);
  const billDesc = `Bayaran ${params.productName}`.replace(/[^a-zA-Z0-9_ ]/g, " ").slice(0, 100);

  const formData = new URLSearchParams();
  formData.append("userSecretKey", secretKey);
  formData.append("categoryCode", categoryCode);
  formData.append("billName", billName);
  formData.append("billDescription", billDesc);
  formData.append("billPriceSetting", "1");
  formData.append("billPayorInfo", "0");
  formData.append("billAmount", String(amountInCents));
  formData.append("billReturnUrl", params.returnUrl);
  formData.append("billCallbackUrl", params.callbackUrl);
  formData.append("billExternalReferenceNo", String(params.orderId));
  formData.append("billTo", params.customerName);
  formData.append("billEmail", "");
  formData.append("billPhone", "");
  formData.append("billSplitPayment", "0");
  formData.append("billSplitPaymentArgs", "");
  formData.append("billPaymentChannel", "2");
  formData.append("billChargeToCustomer", "1");
  formData.append("billExpiryDays", "1");

  try {
    const res = await fetch(`${TOYYIBPAY_BASE_URL}/index.php/api/createBill`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const text = await res.text();
    console.log("Toyyibpay createBill response:", text);

    const data = JSON.parse(text);
    if (Array.isArray(data) && data[0]?.BillCode) {
      return data[0].BillCode;
    }
    return null;
  } catch (err) {
    console.error("Toyyibpay createBill error:", err);
    return null;
  }
}

export function getBillUrl(billCode: string): string {
  return `${TOYYIBPAY_BASE_URL}/${billCode}`;
}
