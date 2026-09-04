# Automated WhatsApp & SMS Setup Guide for Raksha Sutra

This guide details everything you need to obtain for **100% automated background messaging** (no app switching or manual clicks) and where to configure each credential.

---

## 1. Credentials Checklist

You will configure these in your **Supabase Dashboard** -> **Project Settings** -> **Edge Functions** -> **Secrets**:

### For WhatsApp (Meta WhatsApp Cloud API)
| Secret Name | Description | Where to Find |
| :--- | :--- | :--- |
| `META_WA_ACCESS_TOKEN` | Permanent System User Token or Sandbox Token | Meta Developers Dashboard |
| `META_WA_PHONE_NUMBER_ID` | The ID of your WhatsApp sender number | WhatsApp > API Setup |
| `META_WA_TEMPLATE_NAME` | *(Optional for testing, required for live production)* | WhatsApp Manager > Message Templates |

### For Indian SMS (MSG91)
| Secret Name | Description | Where to Find |
| :--- | :--- | :--- |
| `MSG91_AUTH_KEY` | Your MSG91 API Authentication Key | MSG91 Dashboard > Settings > Authkey |
| `MSG91_SENDER_ID` | 6-character sender ID approved on DLT (e.g., `RAKSHA`) | MSG91 > Sender IDs |
| `MSG91_FLOW_ID` | Flow / Template ID for the SOS template | MSG91 > Campaigns / Flow Builder |

---

## 2. Step-by-Step: How to Get Meta WhatsApp Cloud API Credentials

Meta provides a **free sandbox testing environment** with a test number and **1,000 free conversations/month**.

### Step 1: Create a Meta Developer App
1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with your Facebook account.
2. Click **My Apps** > **Create App**.
3. Select **Other** as the use case, then choose **Business**.
4. Enter your app name (e.g. `RakshaSutra Safety`) and your contact email, then click **Create App**.

### Step 2: Add WhatsApp to Your App
1. On the app dashboard, scroll to find **WhatsApp** and click **Set up**.
2. Go to **WhatsApp** > **API Setup** on the left menu.
3. You will see:
   - **Temporary access token** (valid for 24 hours — great for immediate testing).
   - **Phone number ID** (copy this for `META_WA_PHONE_NUMBER_ID`).
   - **To field**: Add your own phone number here to verify it with an OTP so Meta lets you send test WhatsApp messages to yourself immediately.

### Step 3: Get a Permanent Access Token (For Production)
1. Go to [business.facebook.com/settings](https://business.facebook.com/settings).
2. Under **Users**, click **System Users** > **Add**.
3. Create a System User named `RakshaSutra Dispatcher` with Admin role.
4. Click **Add Assets** > assign your WhatsApp Business Account with full control.
5. Click **Generate New Token**, select `whatsapp_business_messaging` and `whatsapp_business_management` permissions, and choose expiration: **Never**.
6. Copy this token for `META_WA_ACCESS_TOKEN`.

### Step 4: Add Your Production Indian Phone Number
1. In WhatsApp > API Setup, click **Add Phone Number**.
2. Enter a dedicated phone number (a regular mobile SIM or landline that is **not** currently registered on standard WhatsApp).
3. Verify via OTP.

### Step 5: Create the SOS Alert Template (Utility Category)
1. Go to WhatsApp Manager > **Message Templates** > **Create Template**.
2. Category: **Utility**. Name: `raksha_sos_alert`.
3. Body text:
   > `🚨 URGENT SOS ALERT: {{1}} has triggered an emergency SOS and needs immediate assistance. View live location: {{2}}`
4. Submit for review (Approval usually takes 2 to 15 minutes).
5. Set `META_WA_TEMPLATE_NAME=raksha_sos_alert` in Supabase Secrets.

---

## 3. Step-by-Step: How to Get MSG91 SMS Credentials

MSG91 is the primary Indian gateway for low-cost transactional SMS (~₹0.18/SMS).

### Step 1: Sign Up on MSG91
1. Sign up at [msg91.com](https://msg91.com).
2. If you are an early startup, apply for the **MSG91 for Startups** grant to get free SMS credits.

### Step 2: Get Your Auth Key
1. Go to your **Profile / Company Settings** > **Authkey**.
2. Generate or copy your 32-character Auth Key.
3. Set this as `MSG91_AUTH_KEY` in Supabase Secrets.

### Step 3: DLT Registration (Mandatory by Indian Telecom Regulations)
To send automated SMS to Indian mobile numbers legally:
1. Register on any Indian DLT portal (e.g. [Jio DLT / Vilpower](https://vilpower.in) or [Airtel DLT](https://www.airtel.in/business/commercial-communication/home)).
2. Register your business entity as a **Principal Entity**.
3. Register a 6-character Sender ID (Header): e.g. `RAKSHA` or `RAKSUT`.
4. Register a Service Implicit/Explicit SMS Template:
   > `URGENT: {#var#} has triggered an SOS on Raksha Sutra. Live location: {#var#}`
5. Once approved, copy your DLT Template ID and Sender ID.

### Step 4: Create a Flow in MSG91
1. On MSG91, navigate to **Campaign / Flow Builder**.
2. Click **Create Flow**.
3. Select SMS channel, link your approved DLT Template ID, and map variables (`user_name`, `location_link`).
4. Copy the resulting **Flow ID**.
5. Set `MSG91_FLOW_ID` and `MSG91_SENDER_ID` in Supabase Secrets.

---

## 4. How to Add the Secrets to Supabase

### Option A: Via Supabase Web Dashboard (Easiest)
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Click **Project Settings** (gear icon) on the left sidebar.
3. Click **Edge Functions**.
4. In the **Secrets** section, click **Add new secret** and add:
   - `META_WA_ACCESS_TOKEN` = `...`
   - `META_WA_PHONE_NUMBER_ID` = `...`
   - `META_WA_TEMPLATE_NAME` = `raksha_sos_alert` *(optional during sandbox testing)*
   - `MSG91_AUTH_KEY` = `...`
   - `MSG91_SENDER_ID` = `RAKSHA`
   - `MSG91_FLOW_ID` = `...`

### Option B: Via Supabase CLI
```bash
supabase secrets set META_WA_ACCESS_TOKEN="your_meta_token" META_WA_PHONE_NUMBER_ID="your_phone_id" MSG91_AUTH_KEY="your_msg91_key" MSG91_FLOW_ID="your_flow_id" MSG91_SENDER_ID="RAKSHA"
```

---

## 5. Summary of Dispatch Architecture

```
User triggers SOS
       │
       ▼
Supabase Edge Function (`dispatch-sos`)
       │
       ├─► 1. Meta WhatsApp Cloud API (~₹0.115) [Primary Automated Dispatch]
       │      └─ Direct server-to-recipient push to emergency contacts & Rakshaks.
       │
       └─► 2. MSG91 Indian SMS (~₹0.18) [Automated Redundancy Fallback]
              └─ Automatically triggers if WhatsApp is undelivered or offline.
```
