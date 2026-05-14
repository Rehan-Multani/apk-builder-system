import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Web to APK',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
      ),
      home: const WebViewScreen(),
    );
  }
}

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  String? targetUrl;
  Color? splashColor;
  int splashDuration = 2;
  bool isLoading = true;
  bool isSplashFinished = false;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    try {
      final String response = await rootBundle.loadString('assets/config.json');
      final data = await json.decode(response);
      
      setState(() {
        targetUrl = data['url'];
        splashDuration = int.tryParse(data['splashDuration']?.toString() ?? '2') ?? 2;
        
        // Parse hex color
        String colorHex = data['splashColor']?.toString().replaceAll('#', '') ?? 'ffffff';
        splashColor = Color(int.parse('FF$colorHex', radix: 16));
        
        _initController();
      });

      // Show splash for specified duration
      await Future.delayed(Duration(seconds: splashDuration));
      if (mounted) {
        setState(() {
          isSplashFinished = true;
        });
      }
    } catch (e) {
      debugPrint('Error loading config: $e');
      setState(() => isSplashFinished = true);
    }
  }

  void _initController() {
    if (targetUrl == null) return;

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() => isLoading = true);
          },
          onPageFinished: (String url) {
            setState(() => isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView Error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse(targetUrl!));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: splashColor ?? Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            if (targetUrl != null && isSplashFinished)
              WebViewWidget(controller: _controller),
            
            // Flutter Splash Screen
            if (!isSplashFinished)
              Container(
                color: splashColor ?? Colors.white,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset(
                        'assets/launch_image.png',
                        width: 150,
                        height: 150,
                        errorBuilder: (context, error, stackTrace) => const SizedBox(),
                      ),
                      const SizedBox(height: 24),
                      CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(
                          (splashColor?.computeLuminance() ?? 0) > 0.5 ? Colors.black : Colors.white
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Loading indicator for WebView
            if (isSplashFinished && isLoading)
              const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
