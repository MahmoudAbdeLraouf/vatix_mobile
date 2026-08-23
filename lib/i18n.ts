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
  expiredListing: string
  expiredListingHint: string
  expiredStore: string
  expiredStoreHint: string
  backToListings: string
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
  contactPhone: string
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
  chatSubtitle: string
  shareProduct: string
  similarProducts: string
  // Safety tips (shown on product detail)
  safetyTipsTitle: string
  safetyTipsIntro: string
  safetyInspectDevice: string
  safetyMeetPublic: string
  safetyVerifyBeforePay: string
  safetyNeverShareOtp: string
  safetyReportSuspicious: string
  // Store
  followStore: string
  unfollowStore: string
  storeProducts: string
  contactStore: string
  storeWebsite: string
  websiteSubtitle: string
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
  unauthorizedError: string
  sessionExpiredError: string
  accountDeletionError: string
  walletNotAvailable: string
  phoneRequired: string
  unsupportedOperation: string
  submissionFailed: string
  fillRequiredFields: string
  messageTooShort: string
  somethingWentWrong: string
  subscriptionExpiredCannotEdit: string
  failedToLoadProduct: string
  waitForUploadsToFinish: string
  maxAdsReached: (n: number) => string
  uploadFailed: string
  someImagesFailedUpload: string
  sessionExpiredLogIn: string
  permissionRequired: string
  allowPhotoAccess: string
  passwordUpdated: string
  settingsSaved: string
  enterPasswordToConfirm: string
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
  about: string
  viewMore: string
  viewLess: string
  chooseNumber: string
  mainPhone: string
  share: string
  socialMedia: string
  promote: string
  menu: string
  close: string
  // Store share dialog
  storeShareTitle: string
  storeShareDescription: string
  storeShareUrlLabel: string
  storeShareCopy: string
  storeShareCopied: string
  storeShareShare: string
  storeShareGotIt: string
  storeShareText: (name: string) => string
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
  freeMonthFirst: string
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
  totalWhatsappClicks: string
  totalChatContacts: string
  totalContact: string
  storeContacts: string
  storeContactsHint: string
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
  // Phase 4 — Mobile Wallet
  payWithMobileWallet: string
  mobileWalletAccountLabel: string
  mobileWalletNameLabel: string
  mobileWalletInstructions: string
  mobileWalletSubmitted: string
  mobileWalletPendingTitle: string
  mobileWalletPendingSubtitle: string
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
  // Reviews
  reviews: string
  noReviewsYet: string
  addReview: string
  editReview: string
  saveReview: string
  savingReview: string
  deleteReview: string
  reviewCommentPlaceholder: string
  selectStars: string
  reviewSaved: string
  reviewDeleted: string
  reviewSaveError: string
  signInToReview: string
  signIn: string
  starPoor: string
  starFair: string
  starGood: string
  starVeryGood: string
  starExcellent: string
  minutesAgo: (n: number) => string
  hoursAgo: (n: number) => string
  daysAgo: (n: number) => string
  reviewsCount: (n: number) => string
  // Onboarding
  onboarding: {
    skip: string
    next: string
    back: string
    getStarted: string
    slide1: { title: string; desc: string }
    slide2: { title: string; desc: string }
    slide3: { title: string; desc: string }
  }
  // User-action dialogs
  storeLogoDialog: {
    title: string
    body: string
    dismiss: string
    cta: string
  }
  addProductDialog: {
    title: string
    body: string
    dismiss: string
    cta: string
  }
  expiredRecovery: {
    title: string
    subtitle: string
    optionInstapayTitle: string
    optionInstapayDesc: string
    optionConvertTitle: string
    optionConvertDesc: string
    convertConfirmTitle: string
    convertConfirmBody: string
    convertBtn: string
    converting: string
    back: string
    close: string
    instapayTitle: string
    instapayAccount: string
    instapayAmount: string
    instapayInstructions: string
    buyerPhone: string
    buyerPhonePlaceholder: string
    screenshot: string
    submitInstapay: string
    submitting: string
    missingScreenshot: string
    missingBuyerPhone: string
    instapayDoneTitle: string
    instapayDoneBody: string
    optionMobileWalletTitle: string
    optionMobileWalletDesc: string
    mobileWalletTitle: string
    mobileWalletAccount: string
    mobileWalletAmount: string
    mobileWalletInstructions: string
    submitMobileWallet: string
    mobileWalletDoneTitle: string
    mobileWalletDoneBody: string
  }
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
    expiredListing: 'انتهى الإعلان',
    expiredListingHint: 'انتهى اشتراك صاحب هذا الإعلان — لم يعد متاحًا حاليًا.',
    expiredStore: 'المتجر غير متاح',
    expiredStoreHint: 'انتهى اشتراك هذا المتجر — لم يعد متاحًا حاليًا.',
    backToListings: 'العودة إلى الإعلانات',
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
    contactPhone: 'رقم التواصل',
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
    chatSubtitle: 'رد سريع خلال دقائق',
    shareProduct: 'مشاركة',
    similarProducts: 'منتجات مشابهة',
    // Safety tips
    safetyTipsTitle: 'نصائح للأمان',
    safetyTipsIntro: 'قبل أي دفع، افحص الجهاز جيداً وتحقّق منه. سلامتك أهم من أي صفقة.',
    safetyInspectDevice: 'افحص الجهاز وجرّبه بالكامل قبل تسليم أي مبلغ للبائع.',
    safetyMeetPublic: 'قابل البائع في مكان عام وآمن ويفضّل في وضح النهار.',
    safetyVerifyBeforePay: 'تأكد أن الجهاز يعمل ومطابق للوصف قبل إتمام الدفع.',
    safetyNeverShareOtp: 'لا تشارك أبداً كود التحقق (OTP) أو كلمة المرور أو بيانات بطاقتك مع أي بائع.',
    safetyReportSuspicious: 'إذا شككت في البائع، أوقف الصفقة فوراً وبلّغ فريق دعم Vatix.',
    // Store
    followStore: 'متابعة',
    unfollowStore: 'إلغاء المتابعة',
    storeProducts: 'منتجات المتجر',
    contactStore: 'تواصل مع المتجر',
    storeWebsite: 'زيارة الموقع',
    websiteSubtitle: 'تسوّق من الموقع الرسمي',
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
    unauthorizedError: 'غير مصرّح',
    sessionExpiredError: 'انتهت الجلسة',
    accountDeletionError: 'تعذّر حذف الحساب',
    walletNotAvailable: 'المحفظة غير متاحة لهذه العملية',
    phoneRequired: 'الرجاء إدخال رقم هاتفك',
    unsupportedOperation: 'العملية غير مدعومة',
    submissionFailed: 'فشل الإرسال',
    fillRequiredFields: 'يرجى ملء الحقول المطلوبة',
    messageTooShort: 'الرسالة قصيرة جداً',
    somethingWentWrong: 'حدث خطأ',
    subscriptionExpiredCannotEdit: 'انتهى اشتراكك — لا يمكن تعديل المنتج',
    failedToLoadProduct: 'تعذر تحميل المنتج',
    waitForUploadsToFinish: 'يرجى الانتظار حتى تكتمل الصور',
    maxAdsReached: (n: number) => `وصلت الحد الأقصى للإعلانات (${n})`,
    uploadFailed: 'فشل رفع الملف',
    someImagesFailedUpload: 'بعض الصور لم تُرفع، تأكد من الحجم (أقل من 5 MB) والصيغة (JPG/PNG/WebP)',
    sessionExpiredLogIn: 'انتهت الجلسة، يرجى تسجيل الدخول',
    permissionRequired: 'الأذونات مطلوبة',
    allowPhotoAccess: 'يرجى السماح بالوصول إلى الصور',
    passwordUpdated: 'تم تحديث كلمة المرور.',
    settingsSaved: 'تم حفظ الإعدادات.',
    enterPasswordToConfirm: 'يرجى إدخال كلمة المرور للتأكيد.',
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
    verifiedStoresLabel: 'متجر نشط',
    usersLabel: 'مستخدم',
    // Upgrade banner extended
    upgFeat1: 'صفحة متجر احترافية',
    upgFeat2: 'أولوية الظهور',
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
    upgStoreToPlusSubtitle: 'صفحة متجر خاصة وإحصائيات متقدمة.',
    storePlusActive: 'أنت مشترك في متجر بلَس',
    storePlusActiveSub: 'استمتع بجميع مزايا الاشتراك المميز.',
    manageSubscription: 'إدارة الاشتراك',
    storeInfo: 'بيانات المتجر',
    about: 'عن المتجر',
    viewMore: 'المزيد',
    viewLess: 'أقل',
    chooseNumber: 'اختر رقماً للاتصال',
    mainPhone: 'الرقم الرئيسي',
    share: 'مشاركة',
    socialMedia: 'التواصل الاجتماعي',
    promote: 'إعلانات مروّجة',
    menu: 'القائمة',
    close: 'إغلاق',
    // Store share dialog
    storeShareTitle: 'شارك متجرك مع عملائك',
    storeShareDescription: 'كل ما تحتاج مشاركته هو رابط واحد. عملاؤك سيرون كل منتجاتك في مكان واحد.',
    storeShareUrlLabel: 'رابط متجرك',
    storeShareCopy: 'نسخ الرابط',
    storeShareCopied: 'تم النسخ',
    storeShareShare: 'مشاركة',
    storeShareGotIt: 'فهمت، شكراً',
    storeShareText: (name: string) => `تابع متجر ${name} على ڤاتيكس`,
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
    freeMonthFirst: 'أول شهر مجاناً 🎁',
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
    totalWhatsappClicks: 'واتساب',
    totalChatContacts: 'محادثات',
    totalContact: 'إجمالي التواصل',
    storeContacts: 'تواصل عبر المتجر',
    storeContactsHint: 'تواصل تم مع صفحة متجرك مباشرة',
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
    // Phase 4 — Mobile Wallet
    payWithMobileWallet: 'الدفع عبر محفظة موبايل',
    mobileWalletAccountLabel: 'رقم المحفظة',
    mobileWalletNameLabel: 'اسم المستلم',
    mobileWalletInstructions: 'حوّل المبلغ إلى رقم محفظة الموبايل، ثم ارفع لقطة شاشة للتأكيد.',
    mobileWalletSubmitted: 'تم استلام طلبك، سنقوم بالتحقق وتفعيل الخدمة قريباً.',
    mobileWalletPendingTitle: 'دفعة محفظة موبايل قيد المراجعة',
    mobileWalletPendingSubtitle: 'ستُفعّل خدمتك بمجرد التحقق من التحويل.',
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
    // Reviews
    reviews: 'التقييمات',
    noReviewsYet: 'لا يوجد تقييمات بعد',
    addReview: 'أضف تقييمك',
    editReview: 'تعديل تقييمك',
    saveReview: '✓ حفظ التقييم',
    savingReview: 'جاري الحفظ...',
    deleteReview: 'حذف',
    reviewCommentPlaceholder: 'شارك تجربتك مع هذا الإعلان (اختياري)...',
    selectStars: 'يرجى اختيار عدد النجوم',
    reviewSaved: 'تم حفظ تقييمك ✓',
    reviewDeleted: 'تم حذف تقييمك',
    reviewSaveError: 'تعذّر حفظ التقييم',
    signInToReview: 'لإضافة تقييم',
    signIn: 'سجّل الدخول',
    starPoor: 'سيء',
    starFair: 'مقبول',
    starGood: 'جيد',
    starVeryGood: 'جيد جداً',
    starExcellent: 'ممتاز',
    minutesAgo: (n) => `منذ ${n || 1} دقيقة`,
    hoursAgo: (n) => `منذ ${n} ساعة`,
    daysAgo: (n) => `منذ ${n} يوم`,
    reviewsCount: (n) => `${n} ${n === 1 ? 'تقييم' : 'تقييمات'}`,
    onboarding: {
      skip: 'تخطي',
      next: 'التالي',
      back: 'السابق',
      getStarted: 'ابدأ الآن',
      slide1: {
        title: 'أهلاً بك في ڤاتيكس',
        desc: 'سوق الإلكترونيات الأول في مصر — تصفّح أحدث المنتجات من متاجر موثوقة قريبة منك.',
      },
      slide2: {
        title: 'انشر إعلانك في دقائق',
        desc: 'صوّر منتجك، اكتب تفاصيله، وابدأ في استقبال المشترين مباشرة عبر الواتساب أو الشات.',
      },
      slide3: {
        title: 'تواصل بأمان',
        desc: 'تقييمات حقيقية، تواصل مباشر، ودردشة داخل التطبيق تحفظ محادثاتك في مكان واحد.',
      },
    },
    storeLogoDialog: {
      title: '🎨 اكتمل شكل متجرك',
      body: 'المتاجر التي لديها شعار تحصل على ثقة أكبر من العملاء وتظهر بشكل احترافي في جميع الصفحات. أضف شعار متجرك في دقيقة واحدة.',
      dismiss: 'لاحقاً',
      cta: 'رفع الشعار',
    },
    addProductDialog: {
      title: '✨ ابدأ البيع اليوم',
      body: 'كل إعلان جديد يفتح لك باباً لعميل جديد. أضف منتجك الآن — الأمر لا يستغرق سوى دقائق، وسيظهر على فاتيكس مباشرة.',
      dismiss: 'لاحقاً',
      cta: 'إضافة إعلان',
    },
    expiredRecovery: {
      title: 'انتهى اشتراكك',
      subtitle: 'اختر كيف تريد المتابعة',
      optionInstapayTitle: 'تجديد الاشتراك عبر إنستاباي',
      optionInstapayDesc: 'حوّل من تطبيق البنك وارفع لقطة الشاشة للمراجعة',
      optionConvertTitle: 'التحويل إلى حساب عميل',
      optionConvertDesc: 'أوقف الاشتراك واستخدم حسابك كعميل عادي',
      convertConfirmTitle: 'تأكيد التحويل',
      convertConfirmBody: 'سيتم إخفاء منتجاتك وتحويل حسابك إلى عميل. يمكنك الترقية لاحقاً في أي وقت.',
      convertBtn: 'تأكيد التحويل',
      converting: 'جاري التحويل...',
      back: 'رجوع',
      close: 'إغلاق',
      instapayTitle: 'الدفع عبر إنستاباي',
      instapayAccount: 'حساب المستلم',
      instapayAmount: 'المبلغ',
      instapayInstructions: 'حوّل المبلغ من تطبيق البنك، ثم ارفع لقطة شاشة للتحويل ورقم الهاتف المُرسِل.',
      buyerPhone: 'رقم الهاتف المُرسِل',
      buyerPhonePlaceholder: '01xxxxxxxxx',
      screenshot: 'لقطة شاشة التحويل',
      submitInstapay: 'إرسال للمراجعة',
      submitting: 'جاري الإرسال...',
      missingScreenshot: 'يرجى رفع لقطة الشاشة',
      missingBuyerPhone: 'يرجى إدخال رقم الهاتف',
      instapayDoneTitle: 'تم الاستلام',
      instapayDoneBody: 'سنراجع تحويلك ونفعّل اشتراكك قريباً. يمكنك تسجيل الدخول بعد التأكيد.',
      optionMobileWalletTitle: 'جدّد الاشتراك عبر محفظة موبايل',
      optionMobileWalletDesc: 'حوّل من تطبيق محفظتك وارفع لقطة الشاشة للمراجعة',
      mobileWalletTitle: 'الدفع عبر محفظة موبايل',
      mobileWalletAccount: 'رقم محفظة الموبايل',
      mobileWalletAmount: 'المبلغ',
      mobileWalletInstructions: 'حوّل المبلغ إلى رقم المحفظة أعلاه من تطبيق محفظتك، ثم ارفع صورة إيصال التحويل ورقم الهاتف الذي حوّلت منه.',
      submitMobileWallet: 'إرسال للمراجعة',
      mobileWalletDoneTitle: 'تم الاستلام',
      mobileWalletDoneBody: 'سنراجع تحويلك ونفعّل اشتراكك قريباً. يمكنك تسجيل الدخول بعد التأكيد.',
    },
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
    expiredListing: 'Listing expired',
    expiredListingHint: "This seller's subscription has expired — the listing is no longer available.",
    expiredStore: 'Store unavailable',
    expiredStoreHint: "This store's subscription has expired — it is no longer available.",
    backToListings: 'Back to listings',
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
    contactPhone: 'Contact Number',
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
    chatSubtitle: 'Fast reply in minutes',
    shareProduct: 'Share',
    similarProducts: 'Similar Products',
    // Safety tips
    safetyTipsTitle: 'Safety Tips',
    safetyTipsIntro: 'Before any payment, inspect the device carefully. Your safety matters more than any deal.',
    safetyInspectDevice: 'Inspect and fully test the device before handing any money to the seller.',
    safetyMeetPublic: 'Meet the seller in a safe public place, ideally during daylight hours.',
    safetyVerifyBeforePay: 'Make sure the device works and matches the listing before completing payment.',
    safetyNeverShareOtp: 'Never share your OTP verification code, password, or card details with any seller.',
    safetyReportSuspicious: 'If anything feels suspicious, stop the deal immediately and report it to Vatix support.',
    // Store
    followStore: 'Follow',
    unfollowStore: 'Unfollow',
    storeProducts: 'Store Products',
    contactStore: 'Contact Store',
    storeWebsite: 'Visit Website',
    websiteSubtitle: 'Shop the official site',
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
    unauthorizedError: 'Unauthorized',
    sessionExpiredError: 'Session expired',
    accountDeletionError: 'Could not delete account',
    walletNotAvailable: 'Wallet not available for this operation',
    phoneRequired: 'Please enter your phone number',
    unsupportedOperation: 'Unsupported operation',
    submissionFailed: 'Submission failed',
    fillRequiredFields: 'Please fill required fields',
    messageTooShort: 'Message is too short',
    somethingWentWrong: 'Something went wrong',
    subscriptionExpiredCannotEdit: 'Subscription expired — product cannot be edited',
    failedToLoadProduct: 'Failed to load product',
    waitForUploadsToFinish: 'Please wait for uploads to finish',
    maxAdsReached: (n: number) => `You've reached the max ads (${n})`,
    uploadFailed: 'Upload failed',
    someImagesFailedUpload: "Some images didn't upload — check size (< 5 MB) and format (JPG/PNG/WebP)",
    sessionExpiredLogIn: 'Session expired, please log in',
    permissionRequired: 'Permission required',
    allowPhotoAccess: 'Please allow access to your photo library',
    passwordUpdated: 'Password updated.',
    settingsSaved: 'Settings saved.',
    enterPasswordToConfirm: 'Please enter your password to confirm.',
    // Success
    registrationSuccess: 'Account created successfully',
    productAdded: 'Product added successfully',
    profileUpdated: 'Profile updated successfully',
    // Home hero
    heroBadge: "⚡ Egypt's #1 Electronics Marketplace",
    heroTitle: "Egypt's #1 Electronics Marketplace",
    heroSub: 'Thousands of listings from trusted stores and sellers. Search, compare, and buy safely.',
    heroSearchPlaceholder: 'Search for phones, laptops, screens...',
    heroSearchBtn: '🔍 Search',
    postFreeAd: '+ Post Free Ad',
    browseAll: 'Browse all listings →',
    noAds: 'No listings yet',
    // Hero stats
    activeAds: 'Active Ads',
    verifiedStoresLabel: 'Active Stores',
    usersLabel: 'Users',
    // Upgrade banner extended
    upgFeat1: 'Professional Store Page',
    upgFeat2: 'Priority Placement',
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
    upgStoreToPlusSubtitle: 'Dedicated storefront and advanced analytics.',
    storePlusActive: 'You are on Store Plus',
    storePlusActiveSub: 'Enjoy all premium subscription benefits.',
    manageSubscription: 'Manage Subscription',
    storeInfo: 'Store Info',
    about: 'About',
    viewMore: 'More',
    viewLess: 'Less',
    chooseNumber: 'Choose a number to call',
    mainPhone: 'Main line',
    share: 'Share',
    socialMedia: 'Social Media',
    promote: 'Promoted Ads',
    menu: 'Menu',
    close: 'Close',
    // Store share dialog
    storeShareTitle: 'Share your store with customers',
    storeShareDescription: 'All you need to share is a single link. Your customers will see all your products in one place.',
    storeShareUrlLabel: 'Your store link',
    storeShareCopy: 'Copy link',
    storeShareCopied: 'Copied',
    storeShareShare: 'Share',
    storeShareGotIt: 'Got it, thanks',
    storeShareText: (name: string) => `Check out ${name} on Vatix`,
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
    freeMonthFirst: 'First month free 🎁',
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
    totalWhatsappClicks: 'WhatsApp',
    totalChatContacts: 'Chats',
    totalContact: 'Total Contact',
    storeContacts: 'Store-page Contacts',
    storeContactsHint: 'Contacts made directly on your store page',
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
    // Phase 4 — Mobile Wallet
    payWithMobileWallet: 'Pay via Mobile Wallet',
    mobileWalletAccountLabel: 'Wallet number',
    mobileWalletNameLabel: 'Receiver name',
    mobileWalletInstructions: 'Transfer the amount to the mobile wallet number, then upload a screenshot to confirm.',
    mobileWalletSubmitted: 'Your request has been received. We will verify and activate the service shortly.',
    mobileWalletPendingTitle: 'Mobile wallet payment under review',
    mobileWalletPendingSubtitle: 'Your service will activate as soon as the transfer is verified.',
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
    // Reviews
    reviews: 'Reviews',
    noReviewsYet: 'No reviews yet',
    addReview: 'Add Your Review',
    editReview: 'Edit Your Review',
    saveReview: '✓ Save Review',
    savingReview: 'Saving...',
    deleteReview: 'Delete',
    reviewCommentPlaceholder: 'Share your experience with this listing (optional)...',
    selectStars: 'Please select a star rating',
    reviewSaved: 'Your review has been saved ✓',
    reviewDeleted: 'Your review has been deleted',
    reviewSaveError: 'Could not save your review',
    signInToReview: 'to add a review',
    signIn: 'Sign in',
    starPoor: 'Poor',
    starFair: 'Fair',
    starGood: 'Good',
    starVeryGood: 'Very Good',
    starExcellent: 'Excellent',
    minutesAgo: (n) => `${n || 1}m ago`,
    hoursAgo: (n) => `${n}h ago`,
    daysAgo: (n) => `${n}d ago`,
    reviewsCount: (n) => `${n} review${n === 1 ? '' : 's'}`,
    onboarding: {
      skip: 'Skip',
      next: 'Next',
      back: 'Back',
      getStarted: 'Get Started',
      slide1: {
        title: 'Welcome to Vatix',
        desc: "Egypt's leading electronics marketplace — browse the latest products from trusted stores near you.",
      },
      slide2: {
        title: 'Post your ad in minutes',
        desc: 'Snap your product, add details, and start hearing from buyers directly via WhatsApp or chat.',
      },
      slide3: {
        title: 'Connect with confidence',
        desc: 'Real reviews, direct connections, and in-app chat that keeps every conversation in one place.',
      },
    },
    storeLogoDialog: {
      title: '🎨 Make your store look complete',
      body: 'Stores with a logo earn more customer trust and look more professional everywhere they appear. Add your store logo in under a minute.',
      dismiss: 'Later',
      cta: 'Upload logo',
    },
    addProductDialog: {
      title: '✨ Start selling today',
      body: 'Every new listing opens the door to a new customer. Add your product now — it only takes a few minutes and goes live on Vatix instantly.',
      dismiss: 'Later',
      cta: 'Add product',
    },
    expiredRecovery: {
      title: 'Your subscription has expired',
      subtitle: 'Choose how you want to continue',
      optionInstapayTitle: 'Renew via InstaPay',
      optionInstapayDesc: 'Transfer from your bank app and upload the screenshot for review',
      optionConvertTitle: 'Convert to a client account',
      optionConvertDesc: 'Cancel the subscription and use your account as a regular client',
      convertConfirmTitle: 'Confirm conversion',
      convertConfirmBody: 'Your products will be hidden and your account will become a client account. You can upgrade again anytime.',
      convertBtn: 'Confirm conversion',
      converting: 'Converting…',
      back: 'Back',
      close: 'Close',
      instapayTitle: 'Pay via InstaPay',
      instapayAccount: 'Receiver account',
      instapayAmount: 'Amount',
      instapayInstructions: 'Transfer the amount from your bank app, then upload a screenshot of the transfer and your sending phone number.',
      buyerPhone: 'Sending phone number',
      buyerPhonePlaceholder: '01xxxxxxxxx',
      screenshot: 'Transfer screenshot',
      submitInstapay: 'Submit for review',
      submitting: 'Submitting…',
      missingScreenshot: 'Please upload the screenshot',
      missingBuyerPhone: 'Please enter the phone number',
      instapayDoneTitle: 'Received',
      instapayDoneBody: 'We will review your transfer and activate your subscription soon. You can log in once it is confirmed.',
      optionMobileWalletTitle: 'Renew via Mobile Wallet',
      optionMobileWalletDesc: 'Transfer from your wallet app and upload the screenshot for review',
      mobileWalletTitle: 'Pay via Mobile Wallet',
      mobileWalletAccount: 'Mobile wallet number',
      mobileWalletAmount: 'Amount',
      mobileWalletInstructions: 'Transfer the amount to the wallet number above from your wallet app, then upload the transfer receipt and the phone number you sent from.',
      submitMobileWallet: 'Submit for review',
      mobileWalletDoneTitle: 'Received',
      mobileWalletDoneBody: 'We will review your transfer and activate your subscription soon. You can log in once it is confirmed.',
    },
  },
}
