@JS()
library razorpay_interop;

import 'package:js/js.dart';

@JS('Razorpay')
class Razorpay {
  external Razorpay(RazorpayOptions options);
  external void open();
  external void on(String event, Function handler);
}

@JS()
@anonymous
class RazorpayOptions {
  external String get key;
  external set key(String v);
  
  external int get amount;
  external set amount(int v);
  
  external String get currency;
  external set currency(String v);
  
  external String get name;
  external set name(String v);
  
  external String get description;
  external set description(String v);
  
  external String get image;
  external set image(String v);
  
  external String get order_id;
  external set order_id(String v);
  
  external Function get handler;
  external set handler(Function v);
  
  external RazorpayPrefill get prefill;
  external set prefill(RazorpayPrefill v);
  
  external RazorpayNotes get notes;
  external set notes(RazorpayNotes v);
  
  external RazorpayTheme get theme;
  external set theme(RazorpayTheme v);
  
  external factory RazorpayOptions({
    String key,
    int amount,
    String currency,
    String name,
    String description,
    String image,
    String order_id,
    Function handler,
    RazorpayPrefill prefill,
    RazorpayNotes notes,
    RazorpayTheme theme,
  });
}

@JS()
@anonymous
class RazorpayPrefill {
  external String get name;
  external set name(String v);
  
  external String get email;
  external set email(String v);
  
  external String get contact;
  external set contact(String v);
  
  external factory RazorpayPrefill({String name, String email, String contact});
}

@JS()
@anonymous
class RazorpayNotes {
  external String get address;
  external set address(String v);
  
  external factory RazorpayNotes({String address});
}

@JS()
@anonymous
class RazorpayTheme {
  external String get color;
  external set color(String v);
  
  external factory RazorpayTheme({String color});
}

@JS()
@anonymous
class RazorpayResponse {
  external String get razorpay_payment_id;
  external String get razorpay_order_id;
  external String get razorpay_signature;
}
