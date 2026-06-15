import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class PaymentSuccessScreen extends StatefulWidget {
  final String? orderId;
  final String? paymentId;

  const PaymentSuccessScreen({
    super.key,
    this.orderId,
    this.paymentId,
  });

  @override
  State<PaymentSuccessScreen> createState() => _PaymentSuccessScreenState();
}

class _PaymentSuccessScreenState extends State<PaymentSuccessScreen> {
  bool _isVerifying = true;
  bool _isSuccess = false;

  @override
  void initState() {
    super.initState();
    _verifyPayment();
  }

  Future<void> _verifyPayment() async {
    // Simulate backend verification call
    await Future.delayed(const Duration(seconds: 2));
    
    // Check if we have valid payment details or success status from URL
    if (mounted) {
      setState(() {
        _isVerifying = false;
        _isSuccess = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment Status'),
        centerTitle: true,
      ),
      body: Center(
        child: _isVerifying
            ? const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 20),
                  Text('Verifying payment...'),
                ],
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _isSuccess ? Icons.check_circle : Icons.error,
                    color: _isSuccess ? Colors.green : Colors.red,
                    size: 80,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    _isSuccess ? 'Payment Successful!' : 'Payment Failed',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  if (widget.paymentId != null)
                    Text('Payment ID: ${widget.paymentId}'),
                  const SizedBox(height: 30),
                  ElevatedButton(
                    onPressed: () {
                      context.go('/');
                    },
                    child: const Text('Back to Home'),
                  ),
                ],
              ),
      ),
    );
  }
}
