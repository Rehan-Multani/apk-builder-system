import 'dart:convert';
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

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint("Firebase initialization error: $e");
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

  @override
  void initState() {
    super.initState();
    _loadConfig();
    _requestAllPermissions();
    
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

    // Listen for token refresh
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
        targetUrl = data['url'];
        fcmStoreUrl = data['fcmStoreUrl'];
        if (data['fcmBody'] != null) {
          fcmBody = Map<String, dynamic>.from(data['fcmBody']);
        }
        if (data['apiHeaders'] != null) {
          apiHeaders = Map<String, String>.from(data['apiHeaders']);
        }
        splashDuration = int.tryParse(data['splashDuration']?.toString() ?? '2') ?? 2;
        String colorHex = data['splashColor']?.toString().replaceAll('#', '') ?? 'ffffff';
        splashColor = Color(int.parse('FF$colorHex', radix: 16));
        isConfigLoaded = true;
        
        // Adjust status bar icons based on background color
        SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: splashColor!.computeLuminance() > 0.5 ? Brightness.dark : Brightness.light,
          statusBarBrightness: splashColor!.computeLuminance() > 0.5 ? Brightness.light : Brightness.dark,
        ));
      });

      _initFirebase();

      await Future.delayed(Duration(seconds: splashDuration));
      if (mounted) {
        setState(() => isSplashFinished = true);
      }
    } catch (e) {
      debugPrint('Error loading config: $e');
      setState(() {
        isConfigLoaded = true;
        isSplashFinished = true;
      });
    }
  }

  Future<void> _initFirebase() async {
    try {
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
        'bundleId': 'template_app',
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

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: splashColor ?? Colors.black,
        body: Stack(
          children: [
            if (isConfigLoaded && targetUrl != null)
              Opacity(
                opacity: isSplashFinished ? 1.0 : 0.01,
                child: InAppWebView(
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
                        if (progress > 50) isOffline = false;
                      });
                    },
                    onReceivedError: (controller, request, error) {
                      if (request.isForMainFrame == true) setState(() => isOffline = true);
                    },
                    shouldOverrideUrlLoading: (controller, navigationAction) async {
                      var uri = navigationAction.request.url!;
                      if (!["http", "https", "file", "chrome", "data", "javascript", "about"].contains(uri.scheme)) {
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                          return NavigationActionPolicy.CANCEL;
                        }
                      }
                      return NavigationActionPolicy.ALLOW;
                    },
                  ),
                ),
              
              // Progress bar removed as requested (top scroller)
              
              if (isOffline && isSplashFinished)
                Container(
                  color: Colors.white,
                  width: double.infinity,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.wifi_off_rounded, size: 80, color: Colors.grey),
                      const SizedBox(height: 20),
                      const Text("No Internet Connection", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black54)),
                      const SizedBox(height: 30),
                      ElevatedButton.icon(
                        onPressed: () {
                          setState(() => isOffline = false);
                          webViewController?.reload();
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
            ],
        ),
      ),
    );
  }
}
