import 'dart:js' as js;
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

class PaymentService {
  static void openRazorpay({
    required BuildContext context,
    required String orderId,
    required int amount,
    required String keyId,
  }) {
    if (!kIsWeb) {
      debugPrint("Razorpay Web is only supported on Flutter Web.");
      return;
    }

    js.context.callMethod('eval', [
      '''
      var options = {
        key: '$keyId',
        amount: $amount,
        currency: 'INR',
        order_id: '$orderId',
        name: 'My App',
        handler: function (response) {
          // Send response back to Flutter
          window.dispatchEvent(new CustomEvent('razorpay_success', {
            detail: response
          }));
        }
      };

      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response){
          window.dispatchEvent(new CustomEvent('razorpay_failed', {
            detail: response.error
          }));
      });
      rzp.open();
      '''
    ]);
  }

  static Future<void> payWithPhonePe(String paymentUrl) async {
    final Uri url = Uri.parse(paymentUrl);
    if (await canLaunchUrl(url)) {
      await launchUrl(
        url,
        webOnlyWindowName: '_self', // Opens in same tab to preserve session
      );
    } else {
      debugPrint("Could not launch $paymentUrl");
    }
  }
}
