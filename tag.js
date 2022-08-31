// Sandbox Javascript imports
const getAllEventData = require('getAllEventData');
const sendHttpRequest = require('sendHttpRequest');
const JSON = require('JSON');
const Math = require('Math');
const getTimestampMillis = require('getTimestampMillis');
const sha256Sync = require('sha256Sync');
const getCookieValues = require('getCookieValues');

// Constants
const API_ENDPOINT = 'https://graph.facebook.com';
const API_VERSION = 'v12.0';
const PARTNER_AGENT = 'gtmss-1.0.0-0.0.5';
const GTM_EVENT_MAPPINGS = {
  "add_payment_info": "AddPaymentInfo",
  "add_to_cart": "AddToCart",
  "add_to_wishlist": "AddToWishlist",
  "gtm.dom": "PageView",
  "page_view": "PageView",
  "purchase": "Purchase",
  "search": "Search",
  "begin_checkout": "InitiateCheckout",
  "generate_lead": "Lead",
  "view_item": "ViewContent",
  "sign_up": "CompleteRegistration"
};

function isAlreadyHashed(input){
  return input && (input.match('^[A-Fa-f0-9]{64}$') != null);
}


function hashFunction(input){
  if(input == null || isAlreadyHashed(input)){
    return input;
  }

  return sha256Sync(input.trim().toLowerCase(), {outputEncoding: 'hex'});
}

function getContentFromItems(items) {
    return items.map(item => {
        return {
            "id": item.item_id,
            "title": item.item_name,
            "item_price": item.price,
            "brand": item.item_brand,
            "quantity": item.quantity,
            "category": item.item_category,
        };
    });
}

function getFacebookEventName(gtmEventName) {
  return GTM_EVENT_MAPPINGS[gtmEventName] || gtmEventName;
}



const eventModel = getAllEventData();
const event = {};
event.event_name = getFacebookEventName(eventModel.event_name);
event.event_time = eventModel.event_time || (Math.round(getTimestampMillis() / 1000));
event.event_id = eventModel.event_id;
event.event_source_url = eventModel.page_location;
if(eventModel.action_source || data.actionSource) {
  event.action_source = eventModel.action_source ? eventModel.action_source : data.actionSource;
}

event.user_data = {};
// Default Tag Parameters
event.user_data.client_ip_address = eventModel.ip_override.substring(0, eventModel.ip_override.lastIndexOf(':'));
event.user_data.client_user_agent = eventModel.user_agent;


// Commmon Event Schema Parameters
event.user_data.em = eventModel['x-fb-ud-em'] ||
                        (eventModel.user_data != null ? hashFunction(eventModel.user_data.email_address) : null);
event.user_data.ph = eventModel['x-fb-ud-ph'] ||
                        (eventModel.user_data != null ? hashFunction(eventModel.user_data.phone_number) : null);

const addressData = (eventModel.user_data != null && eventModel.user_data.address != null) ? eventModel.user_data.address : {};
event.user_data.fn = eventModel['x-fb-ud-fn'] || hashFunction(addressData.first_name);
event.user_data.ln = eventModel['x-fb-ud-ln'] || hashFunction(addressData.last_name);
event.user_data.ct = eventModel['x-fb-ud-ct'] || hashFunction(addressData.city);
event.user_data.st = eventModel['x-fb-ud-st'] || hashFunction(addressData.region);
event.user_data.zp = eventModel['x-fb-ud-zp'] || hashFunction(addressData.postal_code);
event.user_data.country = eventModel['x-fb-ud-country'] || hashFunction(addressData.country);

// Conversions API Specific Parameters
event.user_data.ge = eventModel['x-fb-ud-ge'];
event.user_data.db = eventModel['x-fb-ud-db'];
event.user_data.external_id = eventModel['x-fb-ud-external_id'];
event.user_data.subscription_id = eventModel['x-fb-ud-subscription_id'];
event.user_data.fbp = eventModel['x-fb-ck-fbp'] || getCookieValues('_fbp', true)[0];
event.user_data.fbc = eventModel['x-fb-ck-fbc'] || getCookieValues('_fbc', true)[0];

event.custom_data = {};
event.custom_data.currency = eventModel.currency;
event.custom_data.value = eventModel.value;
event.custom_data.search_string = eventModel.search_term;
event.custom_data.order_id = eventModel.transaction_id;
event.custom_data.content_category = eventModel['x-fb-cd-content_category'];
event.custom_data.content_ids = eventModel['x-fb-cd-content_ids'];
event.custom_data.content_name = eventModel['x-fb-cd-content_name'];
event.custom_data.content_type = eventModel['x-fb-cd-content_type'];
event.custom_data.contents = eventModel['x-fb-cd-contents'] ||
                                  (eventModel.items != null ? getContentFromItems(eventModel.items) : null);
event.custom_data.num_items = eventModel['x-fb-cd-num_items'];
event.custom_data.predicted_ltv = eventModel['x-fb-cd-predicted_ltv'];
event.custom_data.status = eventModel['x-fb-cd-status'];
event.custom_data.delivery_category = eventModel['x-fb-cd-delivery_category'];

const eventRequest = {data: [event], partner_agent: PARTNER_AGENT};

if(eventModel.test_event_code || data.testEventCode) {
  eventRequest.test_event_code = eventModel.test_event_code ? eventModel.test_event_code : data.testEventCode;
}

// Posting to Conversions API
const routeParams = 'events?access_token=' + data.apiAccessToken;
const graphEndpoint = [API_ENDPOINT,
                       API_VERSION,
                       data.pixelId,
                       routeParams].join('/');

const requestHeaders = {headers: {'content-type': 'application/json'}, method: 'POST'};
sendHttpRequest(
  graphEndpoint,
  (statusCode, headers, response) => {
    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
      return;
    }
    data.gtmOnFailure();
  },
  requestHeaders,
  JSON.stringify(eventRequest));