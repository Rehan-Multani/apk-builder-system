import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'dart:collection';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

void main() {
  // Use a global error handler to prevent silent crashes
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    
    bool useFirebase = false;
    try {
      final String response = await rootBundle.loadString('assets/config.json');
      final data = json.decode(response);
      useFirebase = data['useFirebase'] ?? false;
    } catch (e) {
      debugPrint("Config load error in main: $e");
    }

    if (useFirebase) {
      try {
        await Firebase.initializeApp();
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
      } catch (e) {
        debugPrint("Firebase initialization error: $e");
      }
    }

    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
    ));

    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

    runApp(const MyApp());
  }, (error, stack) {
    debugPrint("CRITICAL STARTUP ERROR: $error");
    debugPrint(stack.toString());
    // Fallback app to show the error if possible
    runApp(MaterialApp(
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Text("App failed to start: $error", style: const TextStyle(color: Colors.red)),
          ),
        ),
      ),
    ));
  });
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
  InAppWebViewController? webViewController;
  PullToRefreshController? pullToRefreshController;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  String? targetUrl;
  String? fcmStoreUrl;
  Map<String, dynamic>? fcmBody;
  Map<String, String>? apiHeaders;
  Color? splashColor;
  int splashDuration = 2;
  double progress = 0;
  bool isSplashFinished = false;
  bool isConfigLoaded = false;
  bool isOffline = false;
  bool useSafeArea = true;
  bool safeAreaTop = true;
  bool safeAreaBottom = false;
  bool usePaymentGateway = false;
  String paymentGatewayType = '';
  String paymentGatewayKey = '';

  @override
  void initState() {
    super.initState();
    _loadConfig();
    
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> results) {
      if (results.contains(ConnectivityResult.none)) {
        if (!isOffline) setState(() => isOffline = true);
      } else {
        if (isOffline) {
          if (mounted) ScaffoldMessenger.of(context).clearSnackBars();
          setState(() => isOffline = false);
          webViewController?.reload();
        }
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _requestAllPermissions();
    });
    
    pullToRefreshController = PullToRefreshController(
      settings: PullToRefreshSettings(color: Colors.indigo),
      onRefresh: () async {
        if (Platform.isAndroid) {
          webViewController?.reload();
        } else if (Platform.isIOS) {
          webViewController?.loadUrl(urlRequest: URLRequest(url: await webViewController?.getUrl()));
        }
        HapticFeedback.mediumImpact();
      },
    );
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  void _setupFirebaseListeners() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (message.notification != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message.notification!.title ?? 'New Notification'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });

    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      debugPrint("FCM Token Refreshed: $newToken");
      if (fcmStoreUrl != null && fcmStoreUrl!.isNotEmpty) {
        _syncToken(newToken);
      }
    });
  }

  Future<void> _requestAllPermissions() async {
    // Request multiple permissions at once
    await [
      Permission.camera,
      Permission.location,
      Permission.microphone,
      Permission.notification,
    ].request();
  }

  Future<void> _loadConfig() async {
    try {
      final String response = await rootBundle.loadString('assets/config.json');
      final data = await json.decode(response);
      
      setState(() {
        String url = data['url']?.toString() ?? '';
        if (url.isNotEmpty && !url.startsWith('http')) {
          url = 'https://$url';
        }
        targetUrl = url;

        fcmStoreUrl = data['fcmStoreUrl'];
        if (data['fcmBody'] != null) {
          fcmBody = Map<String, dynamic>.from(data['fcmBody']);
        }
        if (data['apiHeaders'] != null) {
          apiHeaders = Map<String, String>.from(data['apiHeaders']);
        }
        splashDuration = int.tryParse(data['splashDuration']?.toString() ?? '2') ?? 2;
        String colorHex = data['splashColor']?.toString().replaceAll('#', '') ?? 'ffffff';
        try {
          splashColor = Color(int.parse('FF$colorHex', radix: 16));
        } catch (e) {
          splashColor = Colors.white;
        }

        // Load Safe Area configurations with bulletproof defaults
        useSafeArea = data['useSafeArea'] != null
            ? (data['useSafeArea'] == true || data['useSafeArea'] == 'true')
            : true;
        safeAreaTop = data['safeAreaTop'] != null
            ? (data['safeAreaTop'] == true || data['safeAreaTop'] == 'true')
            : true;
        safeAreaBottom = data['safeAreaBottom'] != null
            ? (data['safeAreaBottom'] == true || data['safeAreaBottom'] == 'true')
            : false;
            
        usePaymentGateway = data['usePaymentGateway'] != null
            ? (data['usePaymentGateway'] == true || data['usePaymentGateway'] == 'true')
            : false;
        paymentGatewayType = data['paymentGatewayType']?.toString() ?? 'razorpay';
        paymentGatewayKey = data['paymentGatewayKey']?.toString() ?? '';

        isConfigLoaded = true;
        
        // Force light status bar icons for black background
        SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ));
      });

      _initFirebase();

      // Smart Splash Screen: We no longer use a fixed delay.
      // The splash screen will be hidden automatically when the WebView reports 100% progress
      // or when onLoadStop is triggered.
      // Fallback max timeout just in case network is very slow
      Future.delayed(const Duration(seconds: 10), () {
        if (mounted && !isSplashFinished) {
          setState(() => isSplashFinished = true);
        }
      });
    } catch (e) {
      debugPrint('Error loading config: $e');
      setState(() {
        isConfigLoaded = true;
        isSplashFinished = true;
      });
    }
  }

  Future<void> _initFirebase() async {
    bool useFirebase = false;
    try {
      final String response = await rootBundle.loadString('assets/config.json');
      final data = json.decode(response);
      useFirebase = data['useFirebase'] ?? false;
    } catch (_) {}

    if (!useFirebase) return;

    try {
      // Ensure Firebase is initialized before accessing messaging
      await Firebase.initializeApp();
      _setupFirebaseListeners();
      FirebaseMessaging messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);
      
      // Retry token retrieval a few times if it's null
      String? token;
      int retries = 0;
      while (token == null && retries < 3) {
        token = await messaging.getToken();
        if (token == null) {
          await Future.delayed(const Duration(seconds: 2));
          retries++;
        }
      }

      if (token != null) {
        debugPrint("FCM Token: $token");
        await messaging.subscribeToTopic('all');
        if (fcmStoreUrl != null && fcmStoreUrl!.isNotEmpty) {
          _syncToken(token);
        }
      }
    } catch (e) {
      debugPrint("Firebase init error: $e");
    }
  }

  Future<void> _syncToken(String token, {String? userId, String? authToken}) async {
    try {
      if (fcmStoreUrl == null || fcmStoreUrl!.trim().isEmpty) return;
      final cleanUrl = fcmStoreUrl!.trim();

      Map<String, String> requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Flutter-WebToAPK-App',
      };
      
      if (apiHeaders != null) {
        // This will include Content-Type if present in the CURL
        apiHeaders!.forEach((key, value) {
          requestHeaders[key] = value;
        });
      }

      if (authToken != null && authToken.isNotEmpty) {
        requestHeaders['Authorization'] = 'Bearer $authToken';
      }

      final Map<String, dynamic> bodyData = {
        if (fcmBody != null) ...fcmBody!,
        'token': token,
        'fcmToken': token,
        'fcm_token': token,
        'platform': Platform.isAndroid ? 'android' : 'ios',
        'userId': userId,
        'user_id': userId,
        'timestamp': DateTime.now().toIso8601String(),
      };

      debugPrint("Syncing token to: $cleanUrl");
      debugPrint("Headers: $requestHeaders");

      dynamic finalBody;
      bool isFormData = requestHeaders['Content-Type']?.contains('application/x-www-form-urlencoded') ?? false;

      if (isFormData) {
        finalBody = bodyData.map((key, value) => MapEntry(key, value?.toString() ?? ''));
      } else {
        finalBody = json.encode(bodyData);
      }

      final response = await http.post(
        Uri.parse(cleanUrl),
        headers: requestHeaders,
        body: finalBody,
      ).timeout(const Duration(seconds: 20));

      debugPrint("Token sync status: ${response.statusCode}");
      debugPrint("Token sync response: ${response.body}");
    } catch (e) {
      debugPrint("Error syncing token: $e");
    }
  }

  Future<bool> _onWillPop() async {
    if (webViewController != null) {
      if (await webViewController!.canGoBack()) {
        webViewController!.goBack();
        return false;
      }
    }
    return true;
  }

  Widget _buildWebViewBody() {
    return InAppWebView(
      initialUrlRequest: URLRequest(url: WebUri(targetUrl!)),
      pullToRefreshController: pullToRefreshController,
      initialSettings: InAppWebViewSettings(
        javaScriptEnabled: true,
        cacheEnabled: true,
        useHybridComposition: true,
        supportZoom: false,
        allowsInlineMediaPlayback: true,
        javaScriptCanOpenWindowsAutomatically: true,
        mediaPlaybackRequiresUserGesture: false,
        preferredContentMode: UserPreferredContentMode.MOBILE,
        cacheMode: CacheMode.LOAD_DEFAULT,
        useWideViewPort: true,
        loadWithOverviewMode: true,
        hardwareAcceleration: true,
        verticalScrollBarEnabled: false,
        horizontalScrollBarEnabled: false,
        overScrollMode: OverScrollMode.NEVER,
        transparentBackground: true,
        disableVerticalScroll: false,
        disableHorizontalScroll: false,
      ),
      initialUserScripts: UnmodifiableListView<UserScript>([
        UserScript(
          source: """
            var style = document.createElement('style');
            style.innerHTML = '::-webkit-scrollbar { display: none !important; } * { -ms-overflow-style: none !important; scrollbar-width: none !important; }';
            document.head.appendChild(style);
            
            // Also try to prevent pull-to-refresh overscroll glow if possible
            document.documentElement.style.overscrollBehavior = 'none';
            document.body.style.overscrollBehavior = 'none';
            
            \${usePaymentGateway ? '''
            window.APP_PAYMENT_ACTIVE = true;
            window.APP_PAYMENT_GATEWAY = '\${paymentGatewayType}';
            window.APP_PAYMENT_KEY = '\${paymentGatewayKey}';
            ''' : ''}
          """,
          injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
        ),
      ]),
      onWebViewCreated: (controller) {
        webViewController = controller;
        
        controller.addJavaScriptHandler(handlerName: 'setStatusBar', callback: (args) {
          if (args.isNotEmpty) {
            final isDark = args[0] as bool;
            SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
              statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
              statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
            ));
          }
        });

        controller.addJavaScriptHandler(handlerName: 'syncUserToken', callback: (args) {
          if (args.isNotEmpty) {
            final data = args[0];
            final userId = data['userId']?.toString();
            final authToken = data['authToken']?.toString();
            
            FirebaseMessaging.instance.getToken().then((token) {
              if (token != null) {
                _syncToken(token, userId: userId, authToken: authToken);
              }
            });
          }
        });

        controller.addJavaScriptHandler(handlerName: 'shareContent', callback: (args) async {
          if (args.isNotEmpty) {
            final data = args[0];
            final url = data['url']?.toString() ?? '';
            final title = data['title']?.toString() ?? '';
            
            if (url.isNotEmpty) {
              await Share.share(
                url,
                subject: title,
              );
            } else if (data['text'] != null) {
              await Share.share(
                data['text'].toString(),
                subject: title,
              );
            }
          }
        });

        // Handler for triggering native payment from PWA
        controller.addJavaScriptHandler(handlerName: 'startNativePayment', callback: (args) {
          if (args.isNotEmpty) {
            final data = args[0];
            debugPrint("PWA requested native payment: \$data");
            // Native Razorpay/PhonePe SDK logic can be implemented here later.
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text("Native payment requested for \${data['amount']}")),
            );
          }
        });
      },
      onPermissionRequest: (controller, request) async {
        return PermissionResponse(
          resources: request.resources,
          action: PermissionResponseAction.GRANT,
        );
      },
      onGeolocationPermissionsShowPrompt: (controller, origin) async {
        return GeolocationPermissionShowPromptResponse(origin: origin, allow: true, retain: true);
      },
      onProgressChanged: (controller, progress) {
        if (progress == 100) pullToRefreshController?.endRefreshing();
        setState(() {
          this.progress = progress / 100;
          // Smart Splash Screen: hide when progress reaches 100%
          if (progress == 100) isSplashFinished = true;
        });
      },
      onLoadStop: (controller, url) async {
        pullToRefreshController?.endRefreshing();
        setState(() {
          isSplashFinished = true;
        });
      },
      onLoadStart: (controller, url) {
        setState(() {
          isOffline = false;
        });
      },
      onReceivedError: (controller, request, error) {
        if (request.isForMainFrame == true) setState(() => isOffline = true);
      },
      shouldOverrideUrlLoading: (controller, navigationAction) async {
        var uri = navigationAction.request.url!;
        String urlString = uri.toString();

        // 1. Check for Android 'intent://' scheme
        if (uri.scheme == 'intent') {
          // Parse the intent URI to extract the actual scheme (e.g. paytmmp, upi, phonepe)
          // Format: intent://pay?pa=...#Intent;scheme=paytmmp;package=...;end
          if (urlString.contains('#Intent;')) {
            final parts = urlString.split('#Intent;');
            final mainPart = parts[0].replaceFirst('intent://', '');
            final intentParams = parts[1];
            
            // Extract scheme
            String? targetScheme;
            if (intentParams.contains('scheme=')) {
              final schemeMatch = RegExp(r'scheme=([^;]+)').firstMatch(intentParams);
              if (schemeMatch != null) {
                targetScheme = schemeMatch.group(1);
              }
            }

            if (targetScheme != null) {
              final newUrl = '$targetScheme://$mainPart';
              try {
                await launchUrl(Uri.parse(newUrl), mode: LaunchMode.externalApplication);
                return NavigationActionPolicy.CANCEL;
              } catch (e) {
                // If the app is not installed, we can optionally check for fallback_url
                String? fallbackUrl;
                if (intentParams.contains('S.browser_fallback_url=')) {
                  final fallbackMatch = RegExp(r'S\.browser_fallback_url=([^;]+)').firstMatch(intentParams);
                  if (fallbackMatch != null) {
                    fallbackUrl = Uri.decodeComponent(fallbackMatch.group(1)!);
                    await launchUrl(Uri.parse(fallbackUrl), mode: LaunchMode.externalApplication);
                    return NavigationActionPolicy.CANCEL;
                  }
                }
                debugPrint("Could not launch parsed intent: $newUrl");
              }
            }
          }
        }

        // 2. Standard external schemes (upi://, phonepe://, paytmmp://, whatsapp://, etc.)
        if (!["http", "https", "file", "chrome", "data", "javascript", "about"].contains(uri.scheme)) {
          try {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationActionPolicy.CANCEL;
          } catch (e) {
            debugPrint("Could not launch $uri: $e");
          }
        }
        
        return NavigationActionPolicy.ALLOW;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            if (isConfigLoaded && targetUrl != null)
              Opacity(
                opacity: isSplashFinished ? 1.0 : 0.01,
                child: useSafeArea
                    ? SafeArea(
                        top: safeAreaTop,
                        bottom: safeAreaBottom,
                        child: _buildWebViewBody(),
                      )
                    : _buildWebViewBody(),
              ),
              
              // Progress bar removed as requested (top scroller)
              
              if (isOffline && isSplashFinished)
                Container(
                  color: Colors.white,
                  width: double.infinity,
                  height: double.infinity,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.wifi_off_rounded, size: 80, color: Colors.grey),
                      const SizedBox(height: 20),
                      const Text("No Internet Connection", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black54)),
                      const SizedBox(height: 10),
                      const Text("Waiting for network...", style: TextStyle(fontSize: 14, color: Colors.grey)),
                      const SizedBox(height: 30),
                      const CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(Colors.indigo)),
                      const SizedBox(height: 30),
                      ElevatedButton.icon(
                        onPressed: () async {
                          final results = await Connectivity().checkConnectivity();
                          if (results.contains(ConnectivityResult.none)) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).clearSnackBars();
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Still no internet connection. Please wait...'),
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            }
                          } else {
                            setState(() => isOffline = false);
                            webViewController?.reload();
                          }
                        },
                        icon: const Icon(Icons.refresh),
                        label: const Text("Retry"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.indigo,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 12),
                        ),
                      ),
                    ],
                  ),
                ),

              if (!isSplashFinished)
                Container(
                  color: Colors.white, // Background color removed, set to white
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Image.asset(
                          'assets/splash.png',
                          width: 150,
                          height: 150,
                          errorBuilder: (context, error, stackTrace) {
                            return Image.asset(
                              'assets/launch_image.png',
                              width: 150,
                              height: 150,
                              errorBuilder: (c, e, s) => const SizedBox.shrink(),
                            );
                          },
                        ),
                        const SizedBox(height: 24),
                        const CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.indigo),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
        ),
      ),
    );
  }
}
