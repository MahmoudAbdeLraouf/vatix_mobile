export type Locale = 'ar' | 'en'

export interface Translations {
  // Common
  appName: string
  loading: string
  error: string
  retry: string
  cancel: string
  save: string
  delete: string
  edit: string
  done: string
  back: string
  next: string
  search: string
  filter: string
  all: string
  seeAll: string
  noResults: string
  confirm: string
  yes: string
  no: string
  // Auth
  login: string
  logout: string
  register: string
  phone: string
  password: string
  or: string
  confirmPassword: string
  forgotPassword: string
  dontHaveAccount: string
  alreadyHaveAccount: string
  loginTitle: string
  loginSubtitle: string
  registerTitle: string
  registerSubtitle: string
  iAmClient: string
  iAmStore: string
  // Client signup
  firstName: string
  lastName: string
  whatsapp: string
  createClientAccount: string
  // Store signup
  storeName: string
  createStoreAccount: string
  // OTP
  otpTitle: string
  otpSubtitle: string
  otpCode: string
  resendCode: string
  verify: string
  // Tabs
  home: string
  products: string
  stores: string
  dashboard: string
  // Home
  featured: string
  featuredStores: string
  latestProducts: string
  welcomeBack: string
  categories: string
  // Products
  addProduct: string
  productTitle: string
  addPhotos: string
  publish: string
  selectCategory: string
  selectBrand: string
  selectLocation: string
  price: string
  condition: string
  conditionNew: string
  conditionUsed: string
  conditionUsedExcellent: string
  conditionUsedGood: string
  conditionUsedAcceptable: string
  category: string
  brand: string
  location: string
  description: string
  productDetails: string
  callSeller: string
  whatsappSeller: string
  startChat: string
  shareProduct: string
  similarProducts: string
  // Store
  followStore: string
  unfollowStore: string
  storeProducts: string
  contactStore: string
  storeWebsite: string
  // Dashboard
  myAds: string
  favorites: string
  following: string
  messages: string
  profile: string
  settings: string
  subscription: string
  wallet: string
  analytics: string
  branches: string
  promotions: string
  invoices: string
  sectionActivity: string
  sectionAccount: string
  sectionGeneral: string
  // Misc
  currency: string
  egp: string
  from: string
  to: string
  sortBy: string
  sortNewest: string
  sortOldest: string
  sortPriceAsc: string
  sortPriceDesc: string
  clearFilters: string
  // Forgot password
  forgotPasswordTitle: string
  forgotPasswordSubtitle: string
  newPassword: string
  resetPassword: string
  passwordResetSuccess: string
  // Guest
  continueAsGuest: string
  loginRequired: string
  loginToAccess: string
  // Favorites
  addToFavorites: string
  removeFromFavorites: string
  favoritesHeroTitle: string
  favoritesHeroSubtitle: string
  favoritesEmptyTitle: string
  favoritesEmptySubtitle: string
  browseProducts: string
  view: string
  // showPhone
  showPhone: string
  // Notifications
  notifications: string
  noNotifications: string
  markAllRead: string
  // Following
  noFollowing: string
  followingHeroTitle: string
  followingHeroSubtitle: string
  followingEmptyTitle: string
  followingEmptySubtitle: string
  browseStores: string
  visitStore: string
  storePlusLabel: string
  // Promo banners
  promoDealsTitle: string
  promoDealsSubtitle: string
  promoDealsCta: string
  promoStoresTitle: string
  promoStoresSubtitle: string
  promoStoresCta: string
  promoAddTitle: string
  promoAddSubtitle: string
  promoAddCta: string
  // Upgrade banner
  upgradeBannerTitle: string
  upgradeBannerSubtitle: string
  // Home sections
  featuredProducts: string
  brands: string
  allStores: string
  // Settings
  language: string
  // Messages
  typeMessage: string
  send: string
  noConversations: string
  noConversationMessages: string
  startConversation: string
  aboutProduct: string
  store: string
  user: string
  you: string
  generalChat: string
  // Errors
  requiredField: string
  invalidPhone: string
  phoneTaken: string
  passwordTooShort: string
  passwordMismatch: string
  serverError: string
  networkError: string
  errorRetryHint: string
  forbiddenTitle: string
  forbiddenSubtitle: string
  notFoundHint: string
  // Success
  registrationSuccess: string
  productAdded: string
  profileUpdated: string
  // Home hero
  heroBadge: string
  heroTitle: string
  heroSub: string
  heroSearchPlaceholder: string
  heroSearchBtn: string
  postFreeAd: string
  browseAll: string
  noAds: string
  // Hero stats
  activeAds: string
  verifiedStoresLabel: string
  usersLabel: string
  // Upgrade banner extended
  upgFeat1: string
  upgFeat2: string
  upgFeat3: string
  upgFeat4: string
  viewPlans: string
  // Store card
  visit: string
  // Coming soon banner
  appComingSoonBadge: string
  appComingSoonTitle: string
  appComingSoonSub: string
  // Dashboard shell
  dashboardHome: string
  welcomeName: string
  newProductCta: string
  quickStats: string
  instapayPendingTitle: string
  instapayPendingSubtitle: string
  upgClientToStoreTitle: string
  upgClientToStoreSubtitle: string
  upgStoreToPlusTitle: string
  upgStoreToPlusSubtitle: string
  storePlusActive: string
  storePlusActiveSub: string
  manageSubscription: string
  storeInfo: string
  socialMedia: string
  promote: string
  menu: string
  close: string
  // Profile screen
  personalInfo: string
  changePhoto: string
  uploading: string
  photoUpdated: string
  photoUpdateFailed: string
  // Phase 4 — Subscription
  currentPlan: string
  trialActive: string
  activePlan: string
  expiredPlan: string
  freeClientPlan: string
  standardStorePlan: string
  storePlusPlan: string
  trialEndsIn: string
  daysRemaining: string
  daysLeftLabel: string
  upgradeToStore: string
  upgradeToStorePlus: string
  upgradeNow: string
  cancelSubscription: string
  cancelStore: string
  cancelStoreConfirm: string
  renewNow: string
  freeTrialBadge: string
  expiresOn: string
  paymentMethod: string
  choosePaymentMethod: string
  payWithCard: string
  payWithInstapay: string
  payWithWallet: string
  walletBalance: string
  insufficientBalance: string
  paymentSuccess: string
  paymentFailed: string
  paymentPending: string
  subscriptionHistory: string
  paymentHistory: string
  noHistory: string
  // Phase 4 — Wallet
  topUp: string
  topUpWallet: string
  topUpAmount: string
  amountLabel: string
  totalToppedUp: string
  totalSpent: string
  transactionHistory: string
  noTransactions: string
  minTopupAmount: string
  presetAmount: string
  // Phase 4 — Promotions
  promotionBundles: string
  activePromotions: string
  purchasedBundles: string
  selectBundle: string
  selectProduct: string
  promoteNow: string
  promotedUntil: string
  bundleAds: string
  bundleDuration: string
  bundleUsed: string
  bundleRemaining: string
  noBundles: string
  noPromotedProducts: string
  chooseProductToPromote: string
  promoteStep1: string
  promoteStep2: string
  promoteStep3: string
  promoteStep4: string
  promoteStep5: string
  // Phase 4 — Analytics
  totalProducts: string
  activeProducts: string
  totalViews: string
  totalPhoneClicks: string
  totalFavorites: string
  viewsRange: string
  last7Days: string
  last14Days: string
  last30Days: string
  viewsByDay: string
  productsPerformance: string
  noAnalyticsData: string
  // Phase 4 — Invoices
  invoiceType: string
  invoiceAmount: string
  invoiceStatus: string
  invoiceMethod: string
  invoiceDate: string
  invoiceId: string
  filterAll: string
  filterSubscriptions: string
  filterPromotions: string
  // Phase 4 — InstaPay
  uploadScreenshot: string
  buyerPhone: string
  buyerPhoneHint: string
  submitPayment: string
  instapayAccountLabel: string
  instapayNameLabel: string
  instapayInstructions: string
  instapaySubmitted: string
  screenshotRequired: string
  // Phase 4 — Upgrade modal
  newStoreInfo: string
  storeType: string
  storeTypeStore: string
  storeTypeStorePlus: string
  clientDescription: string
  storeDescription: string
  storeLogo: string
  storeCover: string
  planCost: string
  monthlyBilling: string
  paymentSuccessBody: string
  paymentPendingBody: string
  continueToStore: string
  // Update prompt
  updateRequiredTitle: string
  updateRequiredBody: string
  updateAvailableTitle: string
  updateAvailableBody: string
  updateNow: string
  updateLater: string
}

export const translations: Record<Locale, Translations> = {
  ar: {
    appName: 'ڤاتيكس',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    retry: 'إعادة المحاولة',
    cancel: 'إلغاء',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    done: 'تم',
    back: 'رجوع',
    next: 'التالي',
    search: 'بحث...',
    filter: 'تصفية',
    all: 'الكل',
    seeAll: 'عرض الكل',
    noResults: 'لا توجد نتائج',
    confirm: 'تأكيد',
    yes: 'نعم',
    no: 'لا',
    // Auth
    login: 'تسجيل الدخول',
    logout: 'تسجيل الخروج',
    register: 'إنشاء حساب',
    phone: 'رقم الهاتف',
    password: 'كلمة المرور',
    or: 'أو',
    confirmPassword: 'تأكيد كلمة المرور',
    forgotPassword: 'نسيت كلمة المرور؟',
    dontHaveAccount: 'ليس لديك حساب؟',
    alreadyHaveAccount: 'لديك حساب بالفعل؟',
    loginTitle: 'مرحباً بعودتك',
    loginSubtitle: 'سجّل دخولك للمتابعة',
    registerTitle: 'إنشاء حساب جديد',
    registerSubtitle: 'اختر نوع حسابك',
    iAmClient: 'أنا عميل',
    iAmStore: 'أنا متجر',
    firstName: 'الاسم الأول',
    lastName: 'الاسم الأخير',
    whatsapp: 'رقم الواتساب',
    createClientAccount: 'إنشاء حساب عميل',
    storeName: 'اسم المتجر',
    createStoreAccount: 'إنشاء حساب متجر',
    otpTitle: 'التحقق من الهاتف',
    otpSubtitle: 'أدخل رمز التحقق المرسل إلى',
    otpCode: 'رمز التحقق',
    resendCode: 'إعادة الإرسال',
    verify: 'تحقق',
    // Tabs
    home: 'الرئيسية',
    products: 'المنتجات',
    stores: 'المتاجر',
    dashboard: 'حسابي',
    // Home
    featured: 'مميز',
    featuredStores: 'متاجر مميزة',
    latestProducts: 'أحدث المنتجات',
    welcomeBack: 'مرحباً',
    categories: 'الاقسام',
    // Products
    addProduct: 'إضافة منتج',
    productTitle: 'عنوان المنتج',
    addPhotos: 'إضافة صور',
    publish: 'نشر المنتج',
    selectCategory: 'اختر الفئة',
    selectBrand: 'اختر الماركة',
    selectLocation: 'اختر الموقع',
    price: 'السعر',
    condition: 'الحالة',
    conditionNew: 'جديد',
    conditionUsed: 'مستعمل',
    conditionUsedExcellent: 'مستعمل - ممتاز',
    conditionUsedGood: 'مستعمل - جيد',
    conditionUsedAcceptable: 'مستعمل - مقبول',
    category: 'الفئة',
    brand: 'الماركة',
    location: 'الموقع',
    description: 'الوصف',
    productDetails: 'تفاصيل المنتج',
    callSeller: 'اتصال',
    whatsappSeller: 'واتساب',
    startChat: 'مراسلة',
    shareProduct: 'مشاركة',
    similarProducts: 'منتجات مشابهة',
    // Store
    followStore: 'متابعة',
    unfollowStore: 'إلغاء المتابعة',
    storeProducts: 'منتجات المتجر',
    contactStore: 'تواصل مع المتجر',
    storeWebsite: 'الموقع الإلكتروني',
    // Dashboard
    myAds: 'إعلاناتي',
    favorites: 'المفضلة',
    following: 'المتابَعون',
    messages: 'الرسائل',
    profile: 'الملف الشخصي',
    settings: 'الإعدادات',
    subscription: 'الاشتراك',
    wallet: 'المحفظة',
    analytics: 'الإحصائيات',
    branches: 'الفروع',
    promotions: 'الترقيات',
    invoices: 'الفواتير',
    sectionActivity: 'نشاطي',
    sectionAccount: 'حسابي',
    sectionGeneral: 'عام',
    // Misc
    currency: 'جنيه',
    egp: 'ج.م',
    from: 'من',
    to: 'إلى',
    sortBy: 'ترتيب حسب',
    sortNewest: 'الأحدث',
    sortOldest: 'الأقدم',
    sortPriceAsc: 'السعر: الأقل',
    sortPriceDesc: 'السعر: الأعلى',
    clearFilters: 'مسح الكل',
    // Forgot password
    forgotPasswordTitle: 'إعادة تعيين كلمة المرور',
    forgotPasswordSubtitle: 'أدخل رقم هاتفك لاستعادة حسابك',
    newPassword: 'كلمة المرور الجديدة',
    resetPassword: 'تعيين كلمة المرور',
    passwordResetSuccess: 'تم تعيين كلمة المرور بنجاح',
    // Guest
    continueAsGuest: 'تصفح كزائر',
    loginRequired: 'تسجيل الدخول مطلوب',
    loginToAccess: 'يرجى تسجيل الدخول للوصول إلى هذه الميزة',
    // Favorites
    addToFavorites: 'إضافة للمفضلة',
    removeFromFavorites: 'إزالة من المفضلة',
    favoritesHeroTitle: 'إعلاناتك المحفوظة',
    favoritesHeroSubtitle: 'كل ما أعجبك في مكان واحد',
    favoritesEmptyTitle: 'لا توجد إعلانات محفوظة بعد',
    favoritesEmptySubtitle: 'اضغط على ♡ في أي إعلان لحفظه هنا والرجوع إليه لاحقاً.',
    browseProducts: 'تصفح الإعلانات',
    view: 'عرض',
    // showPhone
    showPhone: 'عرض رقم الهاتف للمشترين',
    // Notifications
    notifications: 'الإشعارات',
    noNotifications: 'لا توجد إشعارات',
    markAllRead: 'تعيين الكل كمقروء',
    // Following
    noFollowing: 'لا تتابع أي متاجر بعد',
    followingHeroTitle: 'المتاجر التي تتابعها',
    followingHeroSubtitle: 'اطّلع على جديد متاجرك المفضّلة أولاً',
    followingEmptyTitle: 'لا تتابع أي متجر بعد',
    followingEmptySubtitle: 'تابع المتاجر لتصلك آخر منتجاتها وعروضها هنا.',
    browseStores: 'تصفّح المتاجر',
    visitStore: 'زيارة المتجر',
    storePlusLabel: 'بلس',
    // Promo banners
    promoDealsTitle: 'اكتشف أفضل العروض',
    promoDealsSubtitle: 'إلكترونيات بأسعار تنافسية في مصر',
    promoDealsCta: 'تسوّق الآن',
    promoStoresTitle: 'متاجر موثوقة',
    promoStoresSubtitle: 'تسوّق من أفضل المتاجر المصرية',
    promoStoresCta: 'استعرض المتاجر',
    promoAddTitle: 'أضف منتجك الآن!',
    promoAddSubtitle: 'بع منتجاتك لآلاف المشترين في مصر',
    promoAddCta: 'أضف الآن',
    // Upgrade banner
    upgradeBannerTitle: 'افتح متجرك الآن!',
    upgradeBannerSubtitle: 'أضف منتجاتك وتواصل مع آلاف العملاء',
    // Home sections
    featuredProducts: 'منتجات مميزة',
    brands: 'الماركات',
    allStores: 'جميع المتاجر',
    // Settings
    language: 'اللغة',
    // Messages
    typeMessage: 'اكتب رسالة...',
    send: 'إرسال',
    noConversations: 'لا توجد محادثات',
    noConversationMessages: 'لا توجد رسائل بعد',
    startConversation: 'ابدأ المحادثة بإرسال رسالة',
    aboutProduct: 'المحادثة حول',
    store: 'متجر',
    user: 'مستخدم',
    you: 'أنت',
    generalChat: 'محادثة عامة',
    // Errors
    requiredField: 'هذا الحقل مطلوب',
    invalidPhone: 'رقم هاتف غير صحيح',
    phoneTaken: 'رقم الهاتف مسجّل بالفعل، يرجى تسجيل الدخول',
    passwordTooShort: 'كلمة المرور قصيرة جداً (8 أحرف على الأقل)',
    passwordMismatch: 'كلمتا المرور غير متطابقتين',
    serverError: 'خطأ في الخادم، يرجى المحاولة لاحقاً',
    networkError: 'تعذّر الاتصال بالإنترنت',
    errorRetryHint: 'يرجى المحاولة بعد قليل.',
    forbiddenTitle: 'لا تملك صلاحية الوصول',
    forbiddenSubtitle: 'ليست لديك صلاحية لعرض هذا المحتوى.',
    notFoundHint: 'جرّب تعديل عوامل التصفية.',
    // Success
    registrationSuccess: 'تم إنشاء الحساب بنجاح',
    productAdded: 'تم إضافة المنتج بنجاح',
    profileUpdated: 'تم تحديث الملف الشخصي',
    // Home hero
    heroBadge: '⚡ سوق الإلكترونيات الأول في مصر',
    heroTitle: 'سوق الإلكترونيات الأول في مصر',
    heroSub: 'آلاف الإعلانات من متاجر موثوقة ومستخدمين. ابحث، قارن، واشترِ بأمان.',
    heroSearchPlaceholder: 'ابحث عن جوال، لابتوب، شاشة...',
    heroSearchBtn: '🔍 بحث',
    postFreeAd: '+ إضافة إعلان مجاناً',
    browseAll: 'تصفح كل الإعلانات ←',
    noAds: 'لا توجد إعلانات بعد',
    // Hero stats
    activeAds: 'إعلان نشط',
    verifiedStoresLabel: 'متجر موثق',
    usersLabel: 'مستخدم',
    // Upgrade banner extended
    upgFeat1: 'صفحة متجر احترافية',
    upgFeat2: 'شارة موثق',
    upgFeat3: 'إحصائيات',
    upgFeat4: 'إعلانات غير محدودة',
    viewPlans: 'عرض الباقات',
    // Store card
    visit: 'زيارة المتجر',
    // Coming soon banner
    appComingSoonBadge: 'قريباً',
    appComingSoonTitle: '📱 تطبيق VATIX',
    appComingSoonSub: 'تطبيق الهاتف قادم قريباً على iOS و Android',
    // Dashboard shell
    dashboardHome: 'لوحة التحكم',
    welcomeName: 'مرحباً، {name} 👋',
    newProductCta: 'منتج جديد',
    quickStats: 'نظرة سريعة',
    instapayPendingTitle: 'دفعتك قيد المراجعة',
    instapayPendingSubtitle: 'لديك دفعة InstaPay في انتظار التأكيد. سنقوم بتفعيل خدمتك فور التحقق.',
    upgClientToStoreTitle: 'افتح متجرك على ڤاتيكس',
    upgClientToStoreSubtitle: 'أضف منتجاتك دون قيود، وتواصل مع آلاف العملاء يومياً.',
    upgStoreToPlusTitle: 'ارتقِ إلى متجر بلَس',
    upgStoreToPlusSubtitle: 'صفحة متجر خاصة، شارة موثق، وإحصائيات متقدمة.',
    storePlusActive: 'أنت مشترك في متجر بلَس',
    storePlusActiveSub: 'استمتع بجميع مزايا الاشتراك المميز.',
    manageSubscription: 'إدارة الاشتراك',
    storeInfo: 'بيانات المتجر',
    socialMedia: 'التواصل الاجتماعي',
    promote: 'إعلانات مروّجة',
    menu: 'القائمة',
    close: 'إغلاق',
    // Profile screen
    personalInfo: 'المعلومات الشخصية',
    changePhoto: 'تغيير الصورة',
    uploading: 'جاري الرفع...',
    photoUpdated: 'تم تحديث الصورة',
    photoUpdateFailed: 'تعذّر تحديث الصورة',
    // Phase 4 — Subscription
    currentPlan: 'الخطة الحالية',
    trialActive: 'فترة تجريبية',
    activePlan: 'اشتراك نشط',
    expiredPlan: 'اشتراك منتهي',
    freeClientPlan: 'حساب عميل مجاني',
    standardStorePlan: 'متجر',
    storePlusPlan: 'متجر بلَس',
    trialEndsIn: 'تنتهي التجربة خلال',
    daysRemaining: 'أيام متبقية',
    daysLeftLabel: 'يوم',
    upgradeToStore: 'ترقية إلى متجر',
    upgradeToStorePlus: 'ترقية إلى متجر بلَس',
    upgradeNow: 'ترقية الآن',
    cancelSubscription: 'إلغاء الاشتراك',
    cancelStore: 'إلغاء المتجر',
    cancelStoreConfirm: 'هل أنت متأكد من إلغاء المتجر؟ سيتم تحويل حسابك إلى عميل.',
    renewNow: 'تجديد الآن',
    freeTrialBadge: 'تجربة مجانية',
    expiresOn: 'ينتهي في',
    paymentMethod: 'طريقة الدفع',
    choosePaymentMethod: 'اختر طريقة الدفع',
    payWithCard: 'الدفع بالبطاقة',
    payWithInstapay: 'انستا باي',
    payWithWallet: 'المحفظة',
    walletBalance: 'رصيد المحفظة',
    insufficientBalance: 'الرصيد غير كافٍ',
    paymentSuccess: 'تم الدفع بنجاح',
    paymentFailed: 'فشلت عملية الدفع',
    paymentPending: 'الدفع قيد المراجعة',
    subscriptionHistory: 'سجل الاشتراكات',
    paymentHistory: 'سجل المدفوعات',
    noHistory: 'لا يوجد سجل بعد',
    // Phase 4 — Wallet
    topUp: 'شحن',
    topUpWallet: 'شحن المحفظة',
    topUpAmount: 'مبلغ الشحن',
    amountLabel: 'المبلغ',
    totalToppedUp: 'إجمالي المشحون',
    totalSpent: 'إجمالي المنفَق',
    transactionHistory: 'سجل المعاملات',
    noTransactions: 'لا توجد معاملات',
    minTopupAmount: 'الحد الأدنى 10 جنيه',
    presetAmount: 'اختر مبلغاً سريعاً',
    // Phase 4 — Promotions
    promotionBundles: 'باقات الترويج',
    activePromotions: 'الترويجات النشطة',
    purchasedBundles: 'الباقات المشتراة',
    selectBundle: 'اختر الباقة',
    selectProduct: 'اختر المنتج',
    promoteNow: 'روّج الآن',
    promotedUntil: 'مروَّج حتى',
    bundleAds: 'إعلانات',
    bundleDuration: 'أيام',
    bundleUsed: 'مستخدم',
    bundleRemaining: 'متبقي',
    noBundles: 'لا توجد باقات متاحة',
    noPromotedProducts: 'لا توجد منتجات مروَّجة',
    chooseProductToPromote: 'اختر منتجاً للترويج',
    promoteStep1: 'اختر الباقة',
    promoteStep2: 'اختر المنتج',
    promoteStep3: 'الدفع',
    promoteStep4: 'التأكيد',
    promoteStep5: 'تم',
    // Phase 4 — Analytics
    totalProducts: 'إجمالي المنتجات',
    activeProducts: 'المنتجات النشطة',
    totalViews: 'إجمالي المشاهدات',
    totalPhoneClicks: 'مكالمات الهاتف',
    totalFavorites: 'الإضافات للمفضلة',
    viewsRange: 'نطاق المشاهدات',
    last7Days: 'آخر ٧ أيام',
    last14Days: 'آخر ١٤ يوم',
    last30Days: 'آخر ٣٠ يوم',
    viewsByDay: 'المشاهدات اليومية',
    productsPerformance: 'أداء المنتجات',
    noAnalyticsData: 'لا توجد بيانات كافية بعد',
    // Phase 4 — Invoices
    invoiceType: 'النوع',
    invoiceAmount: 'المبلغ',
    invoiceStatus: 'الحالة',
    invoiceMethod: 'طريقة الدفع',
    invoiceDate: 'التاريخ',
    invoiceId: 'رقم الفاتورة',
    filterAll: 'الكل',
    filterSubscriptions: 'الاشتراكات',
    filterPromotions: 'الترويج',
    // Phase 4 — InstaPay
    uploadScreenshot: 'ارفع صورة إثبات التحويل',
    buyerPhone: 'رقم هاتف الدافع',
    buyerPhoneHint: 'رقم الهاتف المستخدم في التحويل',
    submitPayment: 'إرسال الإثبات',
    instapayAccountLabel: 'الحساب',
    instapayNameLabel: 'الاسم',
    instapayInstructions: 'حوّل المبلغ عبر انستا باي، ثم ارفع لقطة شاشة للتأكيد.',
    instapaySubmitted: 'تم استلام طلبك، سنقوم بالتحقق وتفعيل الخدمة قريباً.',
    screenshotRequired: 'يجب رفع صورة إثبات التحويل',
    // Phase 4 — Upgrade modal
    newStoreInfo: 'بيانات المتجر الجديد',
    storeType: 'نوع المتجر',
    storeTypeStore: 'متجر',
    storeTypeStorePlus: 'متجر بلَس',
    clientDescription: 'شراء وبيع الإلكترونيات كفرد.',
    storeDescription: 'وصف المتجر (اختياري)',
    storeLogo: 'شعار المتجر (اختياري)',
    storeCover: 'صورة الغلاف (اختياري)',
    planCost: 'قيمة الخطة',
    monthlyBilling: 'شهرياً',
    paymentSuccessBody: 'تم تفعيل اشتراكك بنجاح.',
    paymentPendingBody: 'دفعتك قيد المراجعة، سنُفعّل الخدمة فور التحقق.',
    continueToStore: 'المتابعة إلى المتجر',
    // Update prompt
    updateRequiredTitle: 'تحديث مطلوب',
    updateRequiredBody: 'إصدارك من التطبيق لم يعد مدعوماً. حدّث الآن للمتابعة.',
    updateAvailableTitle: 'تحديث جديد متاح',
    updateAvailableBody: 'إصدار أحدث من ڤاتيكس أصبح متاحاً. حدّث الآن للحصول على أفضل تجربة.',
    updateNow: 'تحديث الآن',
    updateLater: 'لاحقاً',
  },
  en: {
    appName: 'Vatix',
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Retry',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    done: 'Done',
    back: 'Back',
    next: 'Next',
    search: 'Search...',
    filter: 'Filter',
    all: 'All',
    seeAll: 'See all',
    noResults: 'No results found',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    // Auth
    login: 'Login',
    logout: 'Logout',
    register: 'Create Account',
    phone: 'Phone Number',
    password: 'Password',
    or: 'or',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot password?',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    loginTitle: 'Welcome Back',
    loginSubtitle: 'Sign in to continue',
    registerTitle: 'Create New Account',
    registerSubtitle: 'Choose your account type',
    iAmClient: "I'm a client",
    iAmStore: "I'm a store",
    firstName: 'First Name',
    lastName: 'Last Name',
    whatsapp: 'WhatsApp Number',
    createClientAccount: 'Create Client Account',
    storeName: 'Store Name',
    createStoreAccount: 'Create Store Account',
    otpTitle: 'Phone Verification',
    otpSubtitle: 'Enter the verification code sent to',
    otpCode: 'Verification Code',
    resendCode: 'Resend',
    verify: 'Verify',
    // Tabs
    home: 'Home',
    products: 'Products',
    stores: 'Stores',
    dashboard: 'My Account',
    // Home
    featured: 'Featured',
    featuredStores: 'Featured Stores',
    latestProducts: 'Latest Products',
    welcomeBack: 'Welcome',
    categories: 'Categories',
    // Products
    addProduct: 'Add Product',
    productTitle: 'Product Title',
    addPhotos: 'Add Photos',
    publish: 'Publish Product',
    selectCategory: 'Select Category',
    selectBrand: 'Select Brand',
    selectLocation: 'Select Location',
    price: 'Price',
    condition: 'Condition',
    conditionNew: 'New',
    conditionUsed: 'Used',
    conditionUsedExcellent: 'Used — Excellent',
    conditionUsedGood: 'Used — Good',
    conditionUsedAcceptable: 'Used — Acceptable',
    category: 'Category',
    brand: 'Brand',
    location: 'Location',
    description: 'Description',
    productDetails: 'Product Details',
    callSeller: 'Call',
    whatsappSeller: 'WhatsApp',
    startChat: 'Chat',
    shareProduct: 'Share',
    similarProducts: 'Similar Products',
    // Store
    followStore: 'Follow',
    unfollowStore: 'Unfollow',
    storeProducts: 'Store Products',
    contactStore: 'Contact Store',
    storeWebsite: 'Website',
    // Dashboard
    myAds: 'My Ads',
    favorites: 'Favorites',
    following: 'Following',
    messages: 'Messages',
    profile: 'Profile',
    settings: 'Settings',
    subscription: 'Subscription',
    wallet: 'Wallet',
    analytics: 'Analytics',
    branches: 'Branches',
    promotions: 'Promotions',
    invoices: 'Invoices',
    sectionActivity: 'My Activity',
    sectionAccount: 'My Account',
    sectionGeneral: 'General',
    // Misc
    currency: 'EGP',
    egp: 'EGP',
    from: 'From',
    to: 'To',
    sortBy: 'Sort by',
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortPriceAsc: 'Price: Low to High',
    sortPriceDesc: 'Price: High to Low',
    clearFilters: 'Clear All',
    // Forgot password
    forgotPasswordTitle: 'Reset Password',
    forgotPasswordSubtitle: 'Enter your phone number to recover your account',
    newPassword: 'New Password',
    resetPassword: 'Reset Password',
    passwordResetSuccess: 'Password reset successfully',
    // Guest
    continueAsGuest: 'Browse as Guest',
    loginRequired: 'Login Required',
    loginToAccess: 'Please log in to access this feature',
    // Favorites
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    favoritesHeroTitle: 'Your saved listings',
    favoritesHeroSubtitle: 'Everything you liked, in one place',
    favoritesEmptyTitle: 'No saved listings yet',
    favoritesEmptySubtitle: 'Tap ♡ on any listing to save it here for later.',
    browseProducts: 'Browse listings',
    view: 'View',
    // showPhone
    showPhone: 'Show phone number to buyers',
    // Notifications
    notifications: 'Notifications',
    noNotifications: 'No notifications yet',
    markAllRead: 'Mark all as read',
    // Following
    noFollowing: 'You are not following any stores yet',
    followingHeroTitle: 'Stores you follow',
    followingHeroSubtitle: 'See new drops from your favorite stores first',
    followingEmptyTitle: 'Not following any stores yet',
    followingEmptySubtitle: 'Follow stores to see their latest products and offers here.',
    browseStores: 'Browse stores',
    visitStore: 'Visit store',
    storePlusLabel: 'Plus',
    // Promo banners
    promoDealsTitle: 'Discover Best Deals',
    promoDealsSubtitle: 'Electronics at competitive prices in Egypt',
    promoDealsCta: 'Shop Now',
    promoStoresTitle: 'Trusted Stores',
    promoStoresSubtitle: "Shop from Egypt's top stores",
    promoStoresCta: 'Browse Stores',
    promoAddTitle: 'List Your Product!',
    promoAddSubtitle: 'Sell to thousands of buyers across Egypt',
    promoAddCta: 'Add Now',
    // Upgrade banner
    upgradeBannerTitle: 'Open Your Store!',
    upgradeBannerSubtitle: 'List products and reach thousands',
    // Home sections
    featuredProducts: 'Featured Products',
    brands: 'Brands',
    allStores: 'All Stores',
    // Settings
    language: 'Language',
    // Messages
    typeMessage: 'Type a message...',
    send: 'Send',
    noConversations: 'No conversations yet',
    noConversationMessages: 'No messages yet',
    startConversation: 'Start the conversation by sending a message',
    aboutProduct: 'About product',
    store: 'Store',
    user: 'User',
    you: 'You',
    generalChat: 'General',
    // Errors
    requiredField: 'This field is required',
    invalidPhone: 'Invalid phone number',
    phoneTaken: 'Phone already registered, please sign in',
    passwordTooShort: 'Password too short (min 8 characters)',
    passwordMismatch: 'Passwords do not match',
    serverError: 'Server error, please try again',
    networkError: 'Network connection failed',
    errorRetryHint: 'Please try again in a moment.',
    forbiddenTitle: 'Access denied',
    forbiddenSubtitle: "You don't have permission to view this.",
    notFoundHint: 'Try adjusting your filters.',
    // Success
    registrationSuccess: 'Account created successfully',
    productAdded: 'Product added successfully',
    profileUpdated: 'Profile updated successfully',
    // Home hero
    heroBadge: "⚡ Egypt's #1 Electronics Marketplace",
    heroTitle: "Egypt's #1 Electronics Marketplace",
    heroSub: 'Thousands of listings from verified stores and sellers. Search, compare, and buy safely.',
    heroSearchPlaceholder: 'Search for phones, laptops, screens...',
    heroSearchBtn: '🔍 Search',
    postFreeAd: '+ Post Free Ad',
    browseAll: 'Browse all listings →',
    noAds: 'No listings yet',
    // Hero stats
    activeAds: 'Active Ads',
    verifiedStoresLabel: 'Verified Stores',
    usersLabel: 'Users',
    // Upgrade banner extended
    upgFeat1: 'Professional Store Page',
    upgFeat2: 'Verified Badge',
    upgFeat3: 'Analytics',
    upgFeat4: 'Unlimited Listings',
    viewPlans: 'View Plans',
    // Store card
    visit: 'Visit Store',
    // Coming soon banner
    appComingSoonBadge: 'Coming Soon',
    appComingSoonTitle: '📱 VATIX App',
    appComingSoonSub: 'Mobile app coming soon on iOS and Android',
    // Dashboard shell
    dashboardHome: 'Dashboard',
    welcomeName: 'Welcome, {name} 👋',
    newProductCta: 'New Product',
    quickStats: 'Quick Stats',
    instapayPendingTitle: 'Payment Under Review',
    instapayPendingSubtitle: 'Your InstaPay payment is awaiting confirmation. Your service will activate once verified.',
    upgClientToStoreTitle: 'Open Your Store on Vatix',
    upgClientToStoreSubtitle: 'List unlimited products and reach thousands of daily buyers.',
    upgStoreToPlusTitle: 'Upgrade to Store Plus',
    upgStoreToPlusSubtitle: 'Dedicated storefront, verified badge, and advanced analytics.',
    storePlusActive: 'You are on Store Plus',
    storePlusActiveSub: 'Enjoy all premium subscription benefits.',
    manageSubscription: 'Manage Subscription',
    storeInfo: 'Store Info',
    socialMedia: 'Social Media',
    promote: 'Promoted Ads',
    menu: 'Menu',
    close: 'Close',
    // Profile screen
    personalInfo: 'Personal Info',
    changePhoto: 'Change Photo',
    uploading: 'Uploading...',
    photoUpdated: 'Photo updated',
    photoUpdateFailed: 'Failed to update photo',
    // Phase 4 — Subscription
    currentPlan: 'Current Plan',
    trialActive: 'Free Trial',
    activePlan: 'Active Subscription',
    expiredPlan: 'Subscription Expired',
    freeClientPlan: 'Free Client Account',
    standardStorePlan: 'Store',
    storePlusPlan: 'Store Plus',
    trialEndsIn: 'Trial ends in',
    daysRemaining: 'days remaining',
    daysLeftLabel: 'days',
    upgradeToStore: 'Upgrade to Store',
    upgradeToStorePlus: 'Upgrade to Store Plus',
    upgradeNow: 'Upgrade Now',
    cancelSubscription: 'Cancel Subscription',
    cancelStore: 'Cancel Store',
    cancelStoreConfirm: 'Are you sure you want to cancel your store? Your account will revert to a client account.',
    renewNow: 'Renew Now',
    freeTrialBadge: 'Free Trial',
    expiresOn: 'Expires on',
    paymentMethod: 'Payment Method',
    choosePaymentMethod: 'Choose Payment Method',
    payWithCard: 'Pay with Card',
    payWithInstapay: 'InstaPay',
    payWithWallet: 'Wallet',
    walletBalance: 'Wallet Balance',
    insufficientBalance: 'Insufficient balance',
    paymentSuccess: 'Payment successful',
    paymentFailed: 'Payment failed',
    paymentPending: 'Payment under review',
    subscriptionHistory: 'Subscription History',
    paymentHistory: 'Payment History',
    noHistory: 'No history yet',
    // Phase 4 — Wallet
    topUp: 'Top up',
    topUpWallet: 'Top up wallet',
    topUpAmount: 'Top-up amount',
    amountLabel: 'Amount',
    totalToppedUp: 'Total Topped Up',
    totalSpent: 'Total Spent',
    transactionHistory: 'Transaction History',
    noTransactions: 'No transactions yet',
    minTopupAmount: 'Minimum 10 EGP',
    presetAmount: 'Quick amount',
    // Phase 4 — Promotions
    promotionBundles: 'Promotion Bundles',
    activePromotions: 'Active Promotions',
    purchasedBundles: 'Purchased Bundles',
    selectBundle: 'Select bundle',
    selectProduct: 'Select product',
    promoteNow: 'Promote Now',
    promotedUntil: 'Promoted until',
    bundleAds: 'ads',
    bundleDuration: 'days',
    bundleUsed: 'used',
    bundleRemaining: 'remaining',
    noBundles: 'No bundles available',
    noPromotedProducts: 'No promoted products',
    chooseProductToPromote: 'Choose a product to promote',
    promoteStep1: 'Select bundle',
    promoteStep2: 'Select product',
    promoteStep3: 'Payment',
    promoteStep4: 'Confirm',
    promoteStep5: 'Done',
    // Phase 4 — Analytics
    totalProducts: 'Total Products',
    activeProducts: 'Active Products',
    totalViews: 'Total Views',
    totalPhoneClicks: 'Phone Clicks',
    totalFavorites: 'Favorites',
    viewsRange: 'Views range',
    last7Days: 'Last 7 days',
    last14Days: 'Last 14 days',
    last30Days: 'Last 30 days',
    viewsByDay: 'Views by Day',
    productsPerformance: 'Products Performance',
    noAnalyticsData: 'Not enough data yet',
    // Phase 4 — Invoices
    invoiceType: 'Type',
    invoiceAmount: 'Amount',
    invoiceStatus: 'Status',
    invoiceMethod: 'Method',
    invoiceDate: 'Date',
    invoiceId: 'Invoice ID',
    filterAll: 'All',
    filterSubscriptions: 'Subscriptions',
    filterPromotions: 'Promotions',
    // Phase 4 — InstaPay
    uploadScreenshot: 'Upload transfer screenshot',
    buyerPhone: 'Sender phone',
    buyerPhoneHint: 'The phone number used to send the transfer',
    submitPayment: 'Submit Payment',
    instapayAccountLabel: 'Account',
    instapayNameLabel: 'Name',
    instapayInstructions: 'Transfer the amount via InstaPay, then upload a screenshot to confirm.',
    instapaySubmitted: 'Your request has been received. We will verify and activate the service shortly.',
    screenshotRequired: 'Transfer screenshot is required',
    // Phase 4 — Upgrade modal
    newStoreInfo: 'New Store Info',
    storeType: 'Store Type',
    storeTypeStore: 'Store',
    storeTypeStorePlus: 'Store Plus',
    clientDescription: 'Buy and sell electronics as an individual.',
    storeDescription: 'Store description (optional)',
    storeLogo: 'Store logo (optional)',
    storeCover: 'Cover image (optional)',
    planCost: 'Plan cost',
    monthlyBilling: 'monthly',
    paymentSuccessBody: 'Your subscription has been activated.',
    paymentPendingBody: 'Your payment is under review. The service will be activated once verified.',
    continueToStore: 'Continue to store',
    // Update prompt
    updateRequiredTitle: 'Update Required',
    updateRequiredBody: 'Your app version is no longer supported. Please update to continue.',
    updateAvailableTitle: 'Update Available',
    updateAvailableBody: 'A newer version of Vatix is available. Update now for the best experience.',
    updateNow: 'Update Now',
    updateLater: 'Later',
  },
}
