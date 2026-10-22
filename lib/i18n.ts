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
  buySlotsNav: string
  promoteStoreNav: string
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
  iapProductUnavailable: string
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
  pendingUpgradeTitle: string
  pendingUpgradeSubtitle: string
  upgClientToStoreTitle: string
  upgClientToStoreSubtitle: string
  manageSubscription: string
  storeInfo: string
  about: string
  viewMore: string
  viewLess: string
  chooseNumber: string
  mainPhone: string
  share: string
  socialMedia: string
  categoriesBrands: string
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
  trialEndsIn: string
  daysRemaining: string
  daysLeftLabel: string
  upgradeToStore: string
  upgradeNow: string
  cancelSubscription: string
  cancelStore: string
  cancelStoreConfirm: string
  cancelReasonPrompt: string
  cancelReasonRequired: string
  cancelReasonDetailRequired: string
  cancelReasonNext: string
  cancelReasonSummaryLabel: string
  cancelReasonExpensive: string
  cancelReasonNoLead: string
  cancelReasonWrongAccount: string
  cancelReasonNoNeed: string
  cancelReasonNeedFeature: string
  cancelReasonOther: string
  cancelReasonNeedFeatureDetail: string
  cancelReasonOtherDetail: string
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
  totalReach: string
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
  reachByDay: string
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
  clientDescription: string
  storeDescription: string
  storeLogo: string
  storeCover: string
  planCost: string
  monthlyBilling: string
  monthly: string
  yearly: string
  perMonthSuffix: string
  perYearSuffix: string
  fromPricePrefix: string
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
  importProducts: {
    chooserTitle: string
    chooserSubtitle: string
    optManual: string
    optShopify: string
    optEasyOrders: string
    optExcel: string
    backToOptions: string
    shopifyTitle: string
    easyOrdersTitle: string
    excelTitle: string
    loading: string
    connectedSince: string
    disconnect: string
    disconnectConfirmTitle: string
    disconnectConfirmBody: string
    cancel: string
    defaultCategory: string
    defaultBrand: string
    defaultsHint: string
    category: string
    brand: string
    selectCategory: string
    selectBrand: string
    removeRow: string
    rowLabel: string
    noTitle: string
    currency: string
    rowsCount: string
    noRows: string
    skippedExisting: string
    errorsHeading: string
    loadMore: string
    confirmBtn: string
    saving: string
    importedTitle: string
    importedBody: string
    pickCategoryForEachRow: string
    pickBrandForEachRow: string
    fixErrors: string
    loadFailed: string
    saveFailed: string
    rateLimited: string
    categoryNotFound: string
    brandNotFound: string
    capReached: string
    capReachedError: string
    capTitle: string
    capUsed: string
    capRemaining: string
    capFull: string
    capHint: string
    capBuySlots: string
    capConvertStore: string
    capStoreTrialHint: string
    ok: string
    shopLabel: string
    shopPlaceholder: string
    shopHint: string
    shopInvalid: string
    shopConnectBtn: string
    shopConnectedTo: string
    shopLoadBtn: string
    shopReconnectNeeded: string
    shopFirstBatchHint: string
    eoConnectLabel: string
    eoApiKeyLabel: string
    eoApiKeyPlaceholder: string
    eoApiKeyRequired: string
    eoConnectBtn: string
    eoConnected: string
    eoLoadBtn: string
    eoReconnectNeeded: string
    eoInvalidKey: string
    eoMissingPermission: string
    eoUpstreamError: string
    eoStepsTitle: string
    eoStep1: string
    eoStep2: string
    eoStep3: string
    eoStep4: string
    eoStep5: string
    eoOpenDashboard: string
    excelSubtitle: string
    excelPickBtn: string
    excelChangeFile: string
    excelTemplate: string
    excelTemplateHint: string
    excelXlsUnsupported: string
    excelUnsupported: string
    excelReadFailed: string
    excelEmpty: string
    mapHeading: string
    mapTitle: string
    mapDescription: string
    mapPrice: string
    mapImages: string
    mapNone: string
    mapPlaceholder: string
    mapRequiredHint: string
    previewBtn: string
    uploadFailed: string
  }
  subscriptionExpiring: {
    title: string
    body: string
    walletBalance: string
    topUpCta: string
    laterCta: string
  }
  usePromoCreditsDialog: {
    title: string
    body: string
    creditsLabel: string
    cta: string
    dismiss: string
  }
  storeCategoriesBrandsDialog: {
    title: string
    hookLine: string
    body: string
    cta: string
    dismiss: string
  }
  categoriesBrandsPage: {
    headline: string
    description: string
    loading: string
    categoriesLabel: string
    brandsLabel: string
    selectedLabel: string
    noCategories: string
    noBrands: string
    saveButton: string
    saving: string
    savedSuccess: string
    saveError: string
  }
  rateApp: {
    title: string
    body: string
    positiveCta: string
    negativeCta: string
  }
  buySlots: {
    navLabel: string
    heading: string
    description: string
    extraSlotsOwned: string
    permanentSlot: string
    walletBalance: string
    loading: string
    noBundles: string
    perSlotPermanent: string
    buyArrow: string
    extraSlotsPermanentSuffix: string
    capReachedTitle: string
    capReachedBody: string
    capReachedCta: string
    choosePaymentMethod: string
    payWithWallet: string
    payWithWalletNote: string
    insufficientWallet: string
    instantTransfer: string
    mobileWallet: string
    walletsListed: string
    applePayCta: string
    applePayProcessing: string
    cancelPayment: string
    yourPhone: string
    phonePlaceholder: string
    transferReceiptPhoto: string
    imageHint: string
    sendReceipt: string
    submitting: string
    missingScreenshot: string
    missingPhone: string
    requestReceivedTitle: string
    withinHours: string
    finishAfterApproval: string
    addListing: string
    buyAnotherPack: string
    paymentSuccessTitle: string
    walletDeductedBody: string
    appleSuccessBody: string
    extraSlotsOwnedLabel: string
    remainingWalletBalance: string
    redirectingToListing: string
    continueImporting: string
    redirectingToImport: string
    finishImportAfterApproval: string
    paymentFailed: string
  }
  promoteStore: {
    heading: string
    description: string
    offerSummary: string
    activeUntil: string
    notPromoted: string
    loadError: string
    retry: string
    storesOnly: string
    renewFirst: string
    comingSoon: string
    promoteAgain: string
    promotedUntilLabel: string
    withinHours: string
    walletDeductedBody: string
    appleSuccessBody: string
    backToDashboard: string
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
    optionAppleTitle: string
    optionAppleDesc: string
    appleProcessing: string
    appleDoneTitle: string
    appleDoneBody: string
  }
  bro: {
    name: string
    badge: string
    navLink: string
    pillLabel: string
    chipCheaper: string
    chipBetter: string
    chipBox: string
    ctaFind: string
    stickyCta: string
    soldTitle: string
    ctaFindAvailable: string
    heroStrip: string
    searchEmptyTitle: string
    searchEmptyBody: string
    searchEmptyCta: string
    intakeTitle: string
    stepCategory: string
    stepBrand: string
    stepModel: string
    stepStorage: string
    stepArea: string
    stepBudget: string
    optional: string
    required: string
    modelPlaceholder: string
    storagePlaceholder: string
    budgetMin: string
    budgetMax: string
    wantsLabel: string
    wantCheaper: string
    wantBetterCondition: string
    wantWithBox: string
    knownFromSearch: string
    edit: string
    submit: string
    submitting: string
    intakeFooter: string
    errModelRequired: string
    errAreaRequired: string
    errBudgetRange: string
    intakeLoadFailed: string
    errCategoryRequired: string
    areaPlaceholder: string
    askingProgress: string
    pillAvailable: string
    pillSold: string
    pillPending: string
    sectionAvailable: string
    sectionSold: string
    cheapestRibbon: string
    priceDrop: string
    priceEgp: string
    chatSeller: string
    viewAd: string
    connecting: string
    stopSearch: string
    rerun: string
    foundButton: string
    searchingUntil: string
    noCandidatesYet: string
    emptyTitle: string
    widenArea: string
    dropBudget: string
    listTitle: string
    listEmpty: string
    tabLabel: string
    foundTitle: string
    foundSubtitle: string
    foundEmpty: string
    foundForRequest: string
    allRequests: string
    newRequest: string
    statusSearching: string
    statusDone: string
    statusExpired: string
    statusCancelled: string
    statusFound: string
    factAvailable: string
    factArea: string
    factWarranty: string
    scratchesNone: string
    scratchesMinor: string
    scratchesRepaired: string
    extraBox: string
    extraInvoice: string
    extraWarranty: string
    sellerQuote: string
    agoNow: string
    agoMinutes: string
    agoHours: string
    agoDays: string
    sellerDisclosure: string
    sellerAsk: string
    qrAvailable: string
    qrSold: string
    qrWrongModel: string
    qrOwnReply: string
    formIntro: string
    fieldLatestPrice: string
    fieldCheckArea: string
    fieldScratches: string
    fieldExtras: string
    fieldWarrantyNote: string
    fieldNote: string
    freeTextPlaceholder: string
    sellerSend: string
    formComposerHint: string
    sellerThanks: string
    priceUpdatePrompt: string
    soldConfirmPrompt: string
    yes: string
    no: string
    optOutPrompt: string
    optOutAction: string
    optOutDone: string
    optInAction: string
    sellerLoginRequired: string
    sellerNotFound: string
    sellerLinkNotYours: string
    sellerLoadFailed: string
    retry: string
    loading: string
    sellerPageTitle: string
    sellerBuyerArea: string
    sellerStatusAvailable: string
    sellerStatusSold: string
    sellerStatusClosed: string
    sellerYourReply: string
    sellerOpenChat: string
    notifStarted: string
    notifFound: string
    notifNone: string
    errRateLimit: string
    errSearchDown: string
    errDisabled: string
    errNotFound: string
    errFinished: string
    errStillRunning: string
    errNotConfirmed: string
    errNoLongerAvailable: string
    errGeneric: string
    errPrice: string
    unavailableTitle: string
    unavailableBody: string
    unavailableHome: string
    // Requests board + seller offers
    browseProducts: string
    foundNavLink: string
    requestsNav: string
    fabChooserTitle: string
    fabPostProduct: string
    fabPostProductSub: string
    fabPostRequest: string
    fabPostRequestSub: string
    makeOffer: string
    makeOfferAgain: string
    offerSent: string
    badgeSearching: string
    badgeOpen: string
    badgeNew: string
    meter: string
    tabFromProducts: string
    tabScratch: string
    tabSaved: string
    saveOffer: string
    offersSection: string
    tagOffer: string
    tagBro: string
    tagOfferBro: string
    cheapest: string
    unavailable: string
    broFoundSection: string
    stripDone: string
    markFound: string
    searchAgain: string
    stateActive: string
    stateClosed: string
    stateUnavailable: string
    stateWithdrawn: string
    myOffersTitle: string
    withdraw: string
    capReached: string
    upgradeNudge: string
    boardTitle: string
    boardAskGeeko: string
    boardSubtitle: string
    boardAllCategories: string
    boardAllAreas: string
    boardFilterAreaPlaceholder: string
    boardFilterCategoryPlaceholder: string
    boardAllBrands: string
    boardFilterBrandPlaceholder: string
    boardCountOne: string
    boardCountTwo: string
    boardCountFew: string
    boardCountMany: string
    boardClearFilters: string
    boardEmpty: string
    boardLoadFailed: string
    boardLoadMore: string
    boardLoadingMore: string
    budgetRange: string
    budgetUpTo: string
    budgetFrom: string
    offersCount: string
    offersCountOne: string
    offersCountNone: string
    cardInArea: string
    budgetLabel: string
    budgetAmtRange: string
    budgetAmtUpTo: string
    budgetAmtFrom: string
    budgetCurrency: string
    budgetOpen: string
    anyCondition: string
    firstOfferHint: string
    storageUnit: string
    sortNewest: string
    sortBudget: string
    allCategories: string
    sheetTitle: string
    sheetFor: string
    sheetClose: string
    sheetLoadFailed: string
    sheetNotFound: string
    offerOpenFailed: string
    pickProduct: string
    noProducts: string
    noSavedOffers: string
    useThis: string
    savedUnavailableHint: string
    backToList: string
    offerTitleLabel: string
    offerTitlePlaceholder: string
    offerPriceLabel: string
    offerAreaLabel: string
    offerAreaPlaceholder: string
    areasLoadFailed: string
    offerPhotosLabel: string
    offerPhotosHint: string
    addPhotos: string
    uploadingPhotos: string
    removePhoto: string
    photosUploadFailed: string
    offerSubmit: string
    offerSubmitting: string
    errOfferTitle: string
    errOfferPrice: string
    meterLabel: string
    capBlockTitle: string
    capUpgradeCta: string
    offerSentToast: string
    saveAsProduct: string
    offerSentProductCreated: string
    offerSentProductFailed: string
    productCapSkipped: string
    productCapSkippedUpgrade: string
    upgradeToStore: string
    done: string
    loginToOffer: string
    savedTab: string
    myOffersEmpty: string
    myOffersLoadFailed: string
    savedLoadFailed: string
    offerNoArea: string
    withdrawConfirm: string
    withdrawing: string
    withdrawFailed: string
    editSaved: string
    editSavedTitle: string
    saveEditBtn: string
    savingEdit: string
    savedEditNote: string
    saveEditFailed: string
    deleteSaved: string
    deleteSavedConfirm: string
    deleteSavedFailed: string
    browseRequests: string
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
    productTitle: 'اسم المنتج',
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
    buySlotsNav: 'شراء خانات',
    promoteStoreNav: 'ترويج المتجر',
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
    iapProductUnavailable: 'المنتج غير متاح حالياً في متجر التطبيقات، حاول مرة أخرى لاحقاً',
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
    pendingUpgradeTitle: 'طلب الترقية قيد المراجعة',
    pendingUpgradeSubtitle: 'سيتم تفعيل الترقية فور موافقة الإدارة على الدفعة.',
    upgClientToStoreTitle: 'افتح متجرك على ڤاتيكس',
    upgClientToStoreSubtitle: 'أضف منتجاتك دون قيود، وتواصل مع آلاف العملاء يومياً.',
    manageSubscription: 'إدارة الاشتراك',
    storeInfo: 'بيانات المتجر',
    about: 'عن المتجر',
    viewMore: 'المزيد',
    viewLess: 'أقل',
    chooseNumber: 'اختر رقماً للاتصال',
    mainPhone: 'الرقم الرئيسي',
    share: 'مشاركة',
    socialMedia: 'التواصل الاجتماعي',
    categoriesBrands: 'الفئات والماركات',
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
    trialEndsIn: 'تنتهي التجربة خلال',
    daysRemaining: 'أيام متبقية',
    daysLeftLabel: 'يوم',
    upgradeToStore: 'ترقية إلى متجر',
    upgradeNow: 'ترقية الآن',
    cancelSubscription: 'إلغاء الاشتراك',
    cancelStore: 'إلغاء المتجر',
    cancelStoreConfirm: 'هل أنت متأكد من إلغاء المتجر؟ سيتم تحويل حسابك إلى عميل.',
    cancelReasonPrompt: 'قبل الإلغاء، ساعدنا نفهم السبب',
    cancelReasonRequired: 'برجاء اختيار سبب الإلغاء',
    cancelReasonDetailRequired: 'برجاء توضيح السبب (حرفين على الأقل)',
    cancelReasonNext: 'التالي',
    cancelReasonSummaryLabel: 'سبب الإلغاء',
    cancelReasonExpensive: 'غالي السعر',
    cancelReasonNoLead: 'لا يوجد عملاء محتملين',
    cancelReasonWrongAccount: 'أنشأت الحساب بالخطأ',
    cancelReasonNoNeed: 'لا أحتاجه الآن',
    cancelReasonNeedFeature: 'أحتاج ميزة إضافية',
    cancelReasonOther: 'سبب آخر',
    cancelReasonNeedFeatureDetail: 'ما هي الميزة التي تحتاجها؟',
    cancelReasonOtherDetail: 'من فضلك وضّح السبب',
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
    totalViews: 'إجمالي التفاعل',
    totalReach: 'إجمالي الوصول',
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
    viewsByDay: 'التفاعل اليومي',
    reachByDay: 'الوصول اليومي',
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
    clientDescription: 'شراء وبيع الإلكترونيات كفرد.',
    storeDescription: 'وصف المتجر (اختياري)',
    storeLogo: 'شعار المتجر',
    storeCover: 'صورة الغلاف (اختياري)',
    planCost: 'قيمة الخطة',
    monthlyBilling: 'شهرياً',
    monthly: 'شهري',
    yearly: 'سنوي',
    perMonthSuffix: '/شهر',
    perYearSuffix: '/سنة',
    fromPricePrefix: 'يبدأ من',
    paymentSuccessBody: 'تم تفعيل اشتراكك بنجاح.',
    paymentPendingBody: 'دفعتك قيد المراجعة، سنُفعّل الخدمة فور التحقق.',
    continueToStore: 'المتابعة إلى المتجر',
    // Update prompt
    updateRequiredTitle: 'حدّث ڤاتيكس للمتابعة',
    updateRequiredBody: 'نسخة جديدة من ڤاتيكس متاحة بتحسينات مهمة. حسابك وبياناتك محفوظة كما هي.',
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
    importProducts: {
      chooserTitle: 'منتجاتك موجودة فين دلوقتي؟',
      chooserSubtitle: 'اختار الطريقة الأنسب ليك لإضافة منتجاتك.',
      optManual: 'مش موجودة في أي حتة، هضيفها بنفسي',
      optShopify: 'عندي متجر على Shopify',
      optEasyOrders: 'عندي متجر على EasyOrders',
      optExcel: 'عندي شيت Excel بالمنتجات',
      backToOptions: 'رجوع لاختيار طريقة الإضافة',
      shopifyTitle: 'استيراد من Shopify',
      easyOrdersTitle: 'استيراد من Easy Orders',
      excelTitle: 'استيراد من Excel / CSV',
      loading: 'جارٍ التحميل…',
      connectedSince: 'متصل منذ {date}',
      disconnect: 'فصل',
      disconnectConfirmTitle: 'فصل الحساب؟',
      disconnectConfirmBody: 'لن تُحذف المنتجات التي استوردتها. يمكنك الربط مرة أخرى في أي وقت.',
      cancel: 'إلغاء',
      defaultCategory: 'التصنيف الافتراضي',
      defaultBrand: 'الماركة الافتراضية',
      defaultsHint: 'يُطبَّق على كل المنتجات، ويمكنك تغييره لكل منتج.',
      category: 'التصنيف',
      brand: 'الماركة',
      selectCategory: 'اختر التصنيف',
      selectBrand: 'اختر الماركة',
      removeRow: 'حذف من الاستيراد',
      rowLabel: 'الصف {row}',
      noTitle: '(بدون عنوان)',
      currency: 'ج.م',
      rowsCount: '{count} منتج جاهز للاستيراد',
      noRows: 'لا توجد منتجات للاستيراد.',
      skippedExisting: 'تم تخطي {n} منتج — مستورد بالفعل',
      errorsHeading: 'أخطاء',
      loadMore: 'تحميل المزيد',
      confirmBtn: 'تأكيد واستيراد {count} منتج',
      saving: 'جارٍ الحفظ…',
      importedTitle: 'تم الاستيراد',
      importedBody: 'تم استيراد {count} منتج بنجاح.',
      pickCategoryForEachRow: 'يرجى اختيار تصنيف لكل منتج للمتابعة.',
      pickBrandForEachRow: 'يرجى اختيار ماركة لكل منتج للمتابعة.',
      fixErrors: 'يرجى إصلاح الأخطاء في الملف وإعادة الرفع.',
      loadFailed: 'تعذر تحميل المنتجات. حاول مرة أخرى.',
      saveFailed: 'فشل حفظ المنتجات',
      rateLimited: 'تم تجاوز حد الطلبات. حاول مرة أخرى بعد {seconds} ثانية.',
      categoryNotFound: 'التصنيف غير موجود في الصف {row}.',
      brandNotFound: 'الماركة غير موجودة في الصف {row}.',
      capReached: 'وصلت للحد الأقصى من الإعلانات. اشترِ مساحات إضافية للمتابعة.',
      capReachedError: 'عدد المنتجات أكبر من رصيدك المتبقي (الحد {cap} إعلان). اشترِ إعلانات إضافية أو حوّل حسابك لمتجر.',
      capTitle: 'رصيد إعلاناتك',
      capUsed: '{count} من {cap} إعلان',
      capRemaining: 'متبقي {remaining}',
      capFull: 'وصلت للحد الأقصى',
      capHint: 'الحساب العادي له حد {cap} إعلانات مدى الحياة. اشترِ إعلانات إضافية أو حوّل حسابك لمتجر بدون حد.',
      capBuySlots: 'شراء إعلانات إضافية',
      capConvertStore: 'تحويل الحساب لمتجر',
      capStoreTrialHint: 'المتجر بدون حد للإعلانات — تجربة مجانية {days} يوم لأول مرة.',
      ok: 'حسناً',
      shopLabel: 'نطاق متجر Shopify',
      shopPlaceholder: 'my-store',
      shopHint: 'اكتب اسم متجرك كما يظهر في رابط myshopify.com.',
      shopInvalid: 'اسم المتجر غير صالح.',
      shopConnectBtn: 'ربط Shopify',
      shopConnectedTo: 'متصل بـ {shop}',
      shopLoadBtn: 'تحميل المنتجات من Shopify',
      shopReconnectNeeded: 'انتهت صلاحية الاتصال بـ Shopify. أعد الاتصال للمتابعة.',
      shopFirstBatchHint: 'يتم عرض أول 50 منتج. استورد ثم حمّل مرة أخرى لاستيراد الباقي.',
      eoConnectLabel: 'ربط حساب Easy Orders',
      eoApiKeyLabel: 'مفتاح واجهة البرمجة (Api-Key)',
      eoApiKeyPlaceholder: 'ألصق مفتاح Api-Key الخاص بك',
      eoApiKeyRequired: 'يرجى إدخال مفتاح Api-Key صحيح.',
      eoConnectBtn: 'ربط Easy Orders',
      eoConnected: 'متصل بـ Easy Orders',
      eoLoadBtn: 'تحميل المنتجات من Easy Orders',
      eoReconnectNeeded: 'انتهت صلاحية الاتصال بـ Easy Orders. أعد الاتصال للمتابعة.',
      eoInvalidKey: 'مفتاح Easy Orders غير صالح. راجع لوحة التحكم ثم حاول مرة أخرى.',
      eoMissingPermission: 'المفتاح لا يملك صلاحية قراءة المنتجات. فعّل صلاحية المنتجات للمفتاح في Easy Orders ثم حاول مرة أخرى.',
      eoUpstreamError: 'تعذّر الاتصال بـ Easy Orders حالياً. حاول مرة أخرى لاحقاً.',
      eoStepsTitle: 'كيفية الحصول على مفتاح Api-Key',
      eoStep1: 'من لوحة تحكم Easy Orders افتح "الإعدادات".',
      eoStep2: 'اختر "Public API" من القائمة.',
      eoStep3: 'اضغط "إنشاء" لإنشاء مفتاح API جديد.',
      eoStep4: 'فعّل صلاحية "عرض جميع المنتجات" (list all products) واحفظ.',
      eoStep5: 'انسخ المفتاح وألصقه هنا، ثم اضغط ربط Easy Orders.',
      eoOpenDashboard: 'فتح لوحة تحكم Easy Orders',
      excelSubtitle: 'ارفع ملف Excel (.xlsx) أو CSV يحتوي على المنتجات لمعاينة البيانات قبل الحفظ.',
      excelPickBtn: 'اختر ملف Excel أو CSV',
      excelChangeFile: 'تغيير الملف',
      excelTemplate: 'تحميل قالب CSV',
      excelTemplateHint: 'عمود الصور يحتوي روابط مفصولة بـ |، أما التصنيف والماركة فيتم اختيارهما بعد الرفع.',
      excelXlsUnsupported: 'صيغة .xls القديمة غير مدعومة. احفظ الملف بصيغة .xlsx أو CSV.',
      excelUnsupported: 'يرجى اختيار ملف .xlsx أو .csv.',
      excelReadFailed: 'تعذّرت قراءة الملف.',
      excelEmpty: 'الملف فارغ.',
      mapHeading: 'ربط الأعمدة',
      mapTitle: 'العنوان',
      mapDescription: 'الوصف',
      mapPrice: 'السعر',
      mapImages: 'الصور',
      mapNone: '— بدون —',
      mapPlaceholder: '— اختر العمود —',
      mapRequiredHint: 'اربط الأعمدة المطلوبة (العنوان، السعر) للمتابعة.',
      previewBtn: 'معاينة',
      uploadFailed: 'فشل رفع الملف',
    },
    subscriptionExpiring: {
      title: 'اشتراكك على وشك الانتهاء',
      body: 'ينتهي اشتراك متجرك في {date}. للتجديد التلقائي، تأكد من وجود رصيد كافٍ في محفظتك قبل هذا التاريخ.',
      walletBalance: 'رصيد المحفظة الحالي',
      topUpCta: 'شحن المحفظة الآن',
      laterCta: 'لاحقاً',
    },
    usePromoCreditsDialog: {
      title: 'عندك أرصدة إعلانات لم تُستخدم',
      body: 'استخدم أرصدة الترويج لرفع منتجاتك إلى أعلى نتائج البحث لمدة 7 أيام.',
      creditsLabel: 'أرصدتك المتاحة',
      cta: 'رَوِّج إعلاناً الآن',
      dismiss: 'لاحقاً',
    },
    storeCategoriesBrandsDialog: {
      title: '🏷️ حسّن ظهور متجرك',
      hookLine: 'متجرك لم يُصنَّف بعد بأي فئات أو ماركات',
      body: 'اختر الفئات والماركات التي يعمل بها متجرك لنساعدك على الظهور للعملاء المهتمين وزيادة فرص التواصل معك.',
      cta: '✨ اختر الفئات والماركات',
      dismiss: 'لاحقاً',
    },
    categoriesBrandsPage: {
      headline: 'الفئات والماركات',
      description: 'اختر الفئات والماركات التي يعمل بها متجرك حتى نساعد العملاء المهتمين في الوصول إليك بسهولة.',
      loading: 'جاري التحميل...',
      categoriesLabel: 'الفئات',
      brandsLabel: 'الماركات',
      selectedLabel: 'مختارة',
      noCategories: 'لا توجد فئات متاحة حالياً',
      noBrands: 'لا توجد ماركات متاحة حالياً',
      saveButton: 'حفظ التغييرات',
      saving: '⏳ جاري الحفظ...',
      savedSuccess: 'تم حفظ التفضيلات بنجاح ✓',
      saveError: 'حدث خطأ أثناء الحفظ',
    },
    rateApp: {
      title: 'تستمتع بفاتيكس؟',
      body: 'رأيك يهمنا. لو التجربة عجبتك، قيّمنا في المتجر — لو عندك ملاحظة، احكيلنا مباشرة.',
      positiveCta: 'نعم، أُقيّم',
      negativeCta: 'أرسل ملاحظة',
    },
    buySlots: {
      navLabel: 'إعلانات إضافية',
      heading: 'اشتري إعلانات إضافية 🎟',
      description: 'كل إعلان إضافي يرفع الحد الأقصى لإعلاناتك بشكل دائم ولا ينتهي.',
      extraSlotsOwned: 'إعلانات إضافية مُلكك',
      permanentSlot: 'إعلان دائم',
      walletBalance: 'رصيد المحفظة',
      loading: 'جاري التحميل...',
      noBundles: 'لا توجد باقات متاحة حالياً.',
      perSlotPermanent: 'ج.م / إعلان · دائم',
      buyArrow: 'اشترِ ←',
      extraSlotsPermanentSuffix: ' إعلان إضافي · دائم',
      capReachedTitle: 'وصلت للحد الأقصى من الإعلانات',
      capReachedBody: 'استخدمت كل الإعلانات المتاحة. اشترِ إعلانات إضافية لإكمال نشر إعلانك.',
      capReachedCta: 'اشترِ إعلانات إضافية',
      choosePaymentMethod: 'اختر طريقة الدفع:',
      payWithWallet: 'الدفع من المحفظة',
      payWithWalletNote: 'سيتم خصم المبلغ من رصيد محفظتك فوراً.',
      insufficientWallet: 'رصيد المحفظة غير كافٍ',
      instantTransfer: 'تحويل فوري',
      mobileWallet: 'محفظة موبايل',
      walletsListed: 'فودافون · اتصالات · وي',
      applePayCta: 'ادفع عبر Apple',
      applePayProcessing: 'جاري إتمام الدفع...',
      cancelPayment: 'إلغاء',
      yourPhone: 'رقمك *',
      phonePlaceholder: '01xxxxxxxxx',
      transferReceiptPhoto: 'صورة إيصال التحويل *',
      imageHint: 'JPG · PNG · صورة واضحة',
      sendReceipt: 'إرسال الإيصال',
      submitting: 'جاري الإرسال...',
      missingScreenshot: 'يرجى رفع صورة الإيصال',
      missingPhone: 'يرجى إدخال رقم الهاتف',
      requestReceivedTitle: 'تم استلام طلبك!',
      withinHours: 'سيقوم فريق Vatix بمراجعة التحويل وإضافة الإعلانات الإضافية خلال 24 ساعة.',
      finishAfterApproval: 'يمكنك إكمال نشر إعلانك بعد الموافقة.',
      addListing: 'أضف إعلان',
      buyAnotherPack: 'اشترِ باقة أخرى ←',
      paymentSuccessTitle: 'تم الدفع بنجاح!',
      walletDeductedBody: 'تم خصم المبلغ من محفظتك وإضافة الإعلانات الإضافية فوراً.',
      appleSuccessBody: 'تم تأكيد الدفع عبر App Store وإضافة الإعلانات الإضافية فوراً.',
      extraSlotsOwnedLabel: 'الإعلانات الإضافية المُلكك:',
      remainingWalletBalance: 'رصيد المحفظة المتبقي:',
      redirectingToListing: 'جاري توجيهك لإكمال الإعلان...',
      continueImporting: 'أكمل الاستيراد',
      redirectingToImport: 'جاري توجيهك لإكمال الاستيراد...',
      finishImportAfterApproval: 'يمكنك إكمال الاستيراد بعد الموافقة.',
      paymentFailed: 'فشل الدفع، حاول مرة أخرى',
    },
    promoteStore: {
      heading: 'ترويج المتجر ⭐',
      description: 'يظهر متجرك المميز في أول قائمة المتاجر مع شارة «مميز» طوال مدة الترويج، ويظهر متجرك أولاً في شريط المتاجر المميزة بصفحات المنتجات. الشراء مرة أخرى يمدّد المدة.',
      offerSummary: '{price} ج.م · {days} أيام',
      activeUntil: 'متجرك مميز حتى {date}',
      notPromoted: 'متجرك غير مميز حالياً',
      loadError: 'تعذّر تحميل عرض الترويج. حاول مرة أخرى.',
      retry: 'إعادة المحاولة',
      storesOnly: 'ترويج المتجر متاح للمتاجر فقط.',
      renewFirst: 'جدّد اشتراكك أولاً قبل ترويج متجرك.',
      comingSoon: 'قريباً',
      promoteAgain: 'مدّد الترويج ←',
      promotedUntilLabel: 'مميز حتى:',
      withinHours: 'سيقوم فريق Vatix بمراجعة التحويل وتفعيل ترويج متجرك خلال 24 ساعة.',
      walletDeductedBody: 'تم خصم المبلغ من محفظتك وتفعيل ترويج متجرك فوراً.',
      appleSuccessBody: 'تم تأكيد الدفع عبر App Store وتفعيل ترويج متجرك فوراً.',
      backToDashboard: 'العودة للوحة التحكم',
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
      optionAppleTitle: 'الدفع عبر Apple',
      optionAppleDesc: 'ادفع من خلال App Store وسيتم تفعيل اشتراكك فوراً',
      appleProcessing: 'جاري إتمام الدفع...',
      appleDoneTitle: 'تم تفعيل اشتراكك',
      appleDoneBody: 'تم تجديد اشتراكك بنجاح. يتم تسجيل دخولك الآن.',
    },
    bro: {
      // Identity
      name: 'جيكو', badge: 'مساعد فاتكس الرسمي', navLink: 'جيكو', pillLabel: 'خلي جيكو يدورلي عليه',
      // Product page card (B) + sticky bar
      chipCheaper: '💸 أرخص من {price}', chipBetter: '✨ حالة أحسن', chipBox: '📦 بالعلبة',
      ctaFind: '🔍 دوّرلي على زيه', stickyCta: 'VB · دوّرلي على زيه ←',
      // Sold-listing takeover (C)
      soldTitle: 'الإعلان ده اتباع 😕 بس جيكو يلاقيلك زيه', ctaFindAvailable: '🔍 دوّرلي على واحد متاح',
      // Entry points
      heroStrip: 'مش لاقي اللي عايزه؟ خلّي جيكو يدوّرلك', searchEmptyTitle: 'ملقيتش اللي بتدوّر عليه؟',
      searchEmptyBody: 'جيكو يسأل البيّاعين بدالك ويرجعلك بالمتاح بس.', searchEmptyCta: '🔍 دوّرلي على {model}',
      // Intake form
      intakeTitle: 'قول لجيكو عايز إيه', stepCategory: 'القسم', stepBrand: 'الماركة', stepModel: 'الموديل',
      stepStorage: 'السعة', stepArea: 'المنطقة', stepBudget: 'الميزانية',
      optional: 'اختياري', required: 'مطلوب', modelPlaceholder: 'مثلاً: آيفون 15 برو', storagePlaceholder: 'مثلاً: 256',
      budgetMin: 'من', budgetMax: 'لحد', wantsLabel: 'عايزه إزاي؟',
      wantCheaper: '💸 أرخص', wantBetterCondition: '✨ حالة أحسن', wantWithBox: '📦 بالعلبة',
      knownFromSearch: '✓ عرفت من بحثك', edit: 'تعديل',
      submit: '🚀 يلا يا جيكو دوّر', submitting: 'بدوّر…',
      intakeFooter: '🔒 جيكو بيعرّف نفسه للبيّاعين إنه مساعد فاتكس بيسأل لمشتري حقيقي، ومبيشاركش رقمك ولا اسمك غير لما تكلّم البيّاع بنفسك.',
      errModelRequired: 'اكتب اسم الموديل', errAreaRequired: 'اختار المنطقة', errBudgetRange: 'أقل ميزانية لازم تكون أقل من أعلى ميزانية',
      intakeLoadFailed: 'مقدرناش نحمّل الأقسام والمناطق، جرّب تاني', errCategoryRequired: 'اختار القسم', areaPlaceholder: 'اختار المنطقة',
      // Request page
      askingProgress: 'بسأل {asked} بيّاعين… {available} أكّدوا',
      pillAvailable: '✓ متاح', pillSold: '✕ اتباع', pillPending: '⏳ لسه بيردّوا',
      sectionAvailable: 'متاحين دلوقتي', sectionSold: 'اتباع · مخفي',
      cheapestRibbon: '⭐ أرخص سعر', priceDrop: 'نزل {amount}', priceEgp: '{price} ج',
      chatSeller: '💬 كلّم البيّاع', viewAd: 'الإعلان', connecting: 'بفتحلك المحادثة…',
      stopSearch: 'وقّف البحث', rerun: 'دوّر تاني',
      foundButton: 'لقيت جهاز خلاص', searchingUntil: 'هفضل أدوّر لحد {date}',
      noCandidatesYet: 'لسه مفيش حد عنده الجهاز ده — هدوّر تاني كل يوم.',
      emptyTitle: 'ملقيتش حاجة دلوقتي', widenArea: 'وسّع المنطقة', dropBudget: 'شيل الميزانية',
      // Requests list
      listTitle: 'طلباتي مع جيكو', listEmpty: 'لسه مفيش طلبات. قول لجيكو عايز إيه وهو يدوّرلك.', newRequest: 'طلب جديد',
      tabLabel: 'Bro', foundTitle: 'اللي لقاه جيكو', foundSubtitle: 'أجهزة البيّاعين أكدوا إنها متاحة', foundEmpty: 'لسه جيكو ملقاش أجهزة. أول ما بيّاع يأكد إن جهازه متاح هيظهر هنا.', foundForRequest: 'لطلب: {model}', allRequests: 'كل طلباتي',
      statusSearching: 'بيدوّر', statusDone: 'خلص', statusExpired: 'انتهى', statusCancelled: 'اتلغى', statusFound: 'لقيت جهاز',
      // Match facts grid
      factAvailable: 'متاح · اتأكد {ago}', factArea: 'المعاينة في {area}', factWarranty: 'الضمان: {note}',
      scratchesNone: 'سليم', scratchesMinor: 'خدش بسيط', scratchesRepaired: 'اتصلّح',
      extraBox: 'علبة', extraInvoice: 'فاتورة', extraWarranty: 'ضمان',
      sellerQuote: 'البيّاع بيقول: «{note}»',
      agoNow: 'دلوقتي', agoMinutes: 'من {n} دقيقة', agoHours: 'من {n} ساعة', agoDays: 'من {n} يوم',
      // Seller side (chat + /bro/i/[id])
      sellerDisclosure: '🤖 ده مساعد فاتكس الآلي. فيه مشتري حقيقي في {area} مهتم بإعلانك. رقمك مش بيتشارك غير لو المشتري كلّمك بنفسه.',
      sellerAsk: 'أهلاً 👋 فيه مشتري بيدوّر على الجهاز ده بالظبط. هو لسه متاح؟',
      qrAvailable: '✅ متاح', qrSold: '❌ اتباع', qrWrongModel: '🔄 مش نفس الموديل', qrOwnReply: '💬 رد بنفسي',
      formIntro: 'تمام 🙏 سؤالين سريعين عشان المشتري يقرر:',
      fieldLatestPrice: 'آخر سعر (ج)', fieldCheckArea: 'مكان المعاينة', fieldScratches: 'حالة الجهاز', fieldExtras: 'معاه إيه؟',
      fieldWarrantyNote: 'تفاصيل الضمان (اختياري)', fieldNote: 'ملاحظة للمشتري (اختياري)',
      freeTextPlaceholder: 'اكتب ردّك هنا', sellerSend: 'ابعت', formComposerHint: 'املأ البيانات في الفورم اللي فوق 👆',
      sellerThanks: 'شكراً! بعتّ ردّك للمشتري ✨ لو عايز يكلّمك هيظهرلك هنا.',
      priceUpdatePrompt: '💡 حدّث سعر إعلانك لـ {price} ج؟', soldConfirmPrompt: 'تعلّم عليه إنه اتباع؟',
      yes: 'أيوه', no: 'لأ',
      optOutPrompt: 'مش عايز رسايل من جيكو؟', optOutAction: 'إيقاف', optOutDone: 'تمام، مش هيوصلك رسايل من جيكو تاني.',
      optInAction: 'رجّع الرسايل', sellerLoginRequired: 'سجّل دخولك الأول عشان تردّ على المشتري.',
      sellerNotFound: 'الطلب ده مش موجود أو مش بتاعك.',
      sellerLinkNotYours: 'الرابط ده مش ليك', sellerLoadFailed: 'مقدرناش نحمّل الطلب، جرّب تاني', retry: 'جرّب تاني', loading: 'بحمّل…',
      sellerPageTitle: 'فيه مشتري مهتم بإعلانك', sellerBuyerArea: 'المشتري في {area}',
      sellerStatusAvailable: '✅ ردّيت إنه متاح', sellerStatusSold: '❌ ردّيت إنه اتباع',
      sellerStatusClosed: 'الطلب ده اتقفل ومبقاش محتاج ردّ', sellerYourReply: 'ردّك: «{text}»',
      sellerOpenChat: '💬 افتح المحادثة',
      // Notifications
      notifStarted: 'بدأت أدوّر ✅ هبعتلك أول ما حد يأكّد.',
      notifFound: 'لقيتلك {n} {model} متاحين في {area} 🎉 أرخص واحد {price} ج…',
      notifNone: 'ملقيتش حاجة متاحة المرة دي 😕 تحب أدوّر تاني أو أوسّع المنطقة؟',
      // Backend error messages (shown verbatim when the API returns them)
      errRateLimit: 'وصلت للحد الأقصى من طلبات Bro دلوقتي، جرّب تاني بعد شوية',
      errSearchDown: 'البحث مش متاح دلوقتي، جرّب تاني كمان شوية', errDisabled: 'جيكو مش متاح دلوقتي',
      errNotFound: 'الطلب مش موجود', errFinished: 'الطلب ده خلص خلاص', errStillRunning: 'مينفعش تعيد الطلب وهو لسه شغال',
      errNotConfirmed: 'البائع لسه ما أكّدش إن الإعلان متاح', errNoLongerAvailable: 'الإعلان ده مبقاش متاح',
      errGeneric: 'حصلت مشكلة، جرّب تاني',
      errPrice: 'اكتب سعر صحيح (لحد رقمين بعد العلامة العشرية)',
      // Feature-off page (/bro/new when Bro is disabled)
      unavailableTitle: 'جيكو مش متاح دلوقتي', unavailableBody: 'الخدمة موقوفة مؤقتاً، جرّب تاني بعد شوية.', unavailableHome: 'ارجع للرئيسية',
      // Requests board + seller offers
      browseProducts: 'تصفّح المنتجات',
      foundNavLink: 'اللي لقاه جيكو',
      requestsNav: 'طلبات الشراء',
      fabChooserTitle: 'عايز تعمل إيه؟',
      fabPostProduct: 'اعرض منتج',
      fabPostProductSub: 'انشر إعلان لجهاز عايز تبيعه',
      fabPostRequest: 'اطلب جهاز',
      fabPostRequestSub: 'قول لجيكو انت عايز إيه والبياعين يبعتولك عروض',
      makeOffer: 'قدّم عرض',
      makeOfferAgain: 'قدّم عرض تاني',
      offerSent: 'عرضك اتبعت ✓',
      badgeSearching: 'جيكو بيدور',
      badgeOpen: 'مفتوح',
      badgeNew: 'جديد',
      meter: '{used} من {cap} · بيتجدد أول الشهر',
      tabFromProducts: 'من منتجاتي',
      tabScratch: 'عرض جديد',
      tabSaved: 'عروضي المحفوظة',
      saveOffer: 'احفظ العرض ده',
      offersSection: '🙋 عروض من البائعين ({n})',
      tagOffer: 'عرض',
      tagBro: 'جيكو',
      tagOfferBro: 'عرض · جيكو',
      cheapest: 'الأرخص',
      unavailable: 'مش متاح',
      broFoundSection: '🔎 لقاها جيكو',
      stripDone: 'جيكو خلّص التدوير · طلبك لسه ظاهر في صفحة الطلبات لحد {date}',
      markFound: 'علّم إنه اتلقى',
      searchAgain: 'دوّر تاني',
      stateActive: 'نشط',
      stateClosed: 'مقفول',
      stateUnavailable: 'مش متاح',
      stateWithdrawn: 'اتسحب',
      myOffersTitle: 'عروضي',
      withdraw: 'اسحب العرض',
      capReached: 'وصلت للحد الأقصى من العروض الشهر ده. هيتجدد في {date}.',
      upgradeNudge: 'عايز تقدّم عروض من غير حد أقصى؟ حوّل حسابك لحساب متجر.',
      boardTitle: 'طلبات الشراء',
      boardAskGeeko: 'اطلب جهاز من جيكو',
      boardSubtitle: 'مشترين بيدوّروا على أجهزة دلوقتي. قدّم عرضك وكلّمهم.',
      boardAllCategories: 'كل الأقسام',
      boardAllAreas: 'كل المناطق',
      boardFilterAreaPlaceholder: 'المنطقة',
      boardFilterCategoryPlaceholder: 'القسم',
      boardAllBrands: 'كل الماركات',
      boardFilterBrandPlaceholder: 'الماركة',
      boardCountOne: 'طلب واحد',
      boardCountTwo: 'طلبين',
      boardCountFew: '{n} طلبات',
      boardCountMany: '{n} طلب',
      boardClearFilters: 'مسح الفلاتر',
      boardEmpty: 'مفيش طلبات مفتوحة دلوقتي. ارجع تشوف بعد شوية.',
      boardLoadFailed: 'مقدرناش نحمّل الطلبات، جرّب تاني',
      boardLoadMore: 'حمّل المزيد',
      boardLoadingMore: 'بحمّل…',
      budgetRange: 'الميزانية: {min} – {max} ج.م',
      budgetUpTo: 'الميزانية: لحد {max} ج.م',
      budgetFrom: 'الميزانية: من {min} ج.م',
      offersCount: '{n} عروض',
      offersCountOne: 'عرض واحد',
      offersCountNone: 'لسه مفيش عروض',
      cardInArea: 'في {area}',
      budgetLabel: 'الميزانية',
      budgetAmtRange: '{min} – {max}',
      budgetAmtUpTo: 'لحد {max}',
      budgetAmtFrom: 'من {min}',
      budgetCurrency: 'ج.م',
      budgetOpen: 'مفتوحة — قدّم سعرك',
      anyCondition: 'أي حالة مناسبة',
      firstOfferHint: '🔥 كن أول واحد يقدّم عرض',
      storageUnit: 'جيجا',
      sortNewest: 'الأحدث',
      sortBudget: 'أعلى ميزانية',
      allCategories: 'الكل',
      sheetTitle: 'قدّم عرضك',
      sheetFor: 'على طلب: {model}',
      sheetClose: 'إغلاق',
      sheetLoadFailed: 'مقدرناش نحمّل البيانات، جرّب تاني',
      sheetNotFound: 'الطلب ده مش متاح للعروض دلوقتي',
      offerOpenFailed: 'معرفناش نفتح الطلب ده. جرّب تاني',
      pickProduct: 'اختار واحد من إعلاناتك',
      noProducts: 'مفيش عندك إعلانات متاحة. اعمل عرض جديد من التبويب التاني.',
      noSavedOffers: 'مفيش عروض محفوظة لسه. احفظ عرض من تبويب «عرض جديد».',
      useThis: 'استخدم ده',
      savedUnavailableHint: 'الإعلان المرتبط بالعرض ده مبقاش متاح',
      backToList: 'رجوع للقائمة',
      offerTitleLabel: 'عنوان العرض',
      offerTitlePlaceholder: 'مثلاً: آيفون 15 برو 256 زي الجديد',
      offerPriceLabel: 'السعر (ج)',
      offerAreaLabel: 'مكان المعاينة',
      offerAreaPlaceholder: 'اختار المنطقة (اختياري)',
      areasLoadFailed: 'مقدرناش نحمّل المناطق',
      offerPhotosLabel: 'صور الجهاز',
      offerPhotosHint: 'لحد {max} صور',
      addPhotos: 'ضيف صور',
      uploadingPhotos: 'برفع الصور…',
      removePhoto: 'شيل الصورة',
      photosUploadFailed: 'مقدرناش نرفع الصور، جرّب تاني',
      offerSubmit: 'ابعت العرض',
      offerSubmitting: 'ببعت…',
      errOfferTitle: 'اكتب عنوان للعرض',
      errOfferPrice: 'اكتب سعر أكبر من صفر (لحد رقمين بعد العلامة العشرية)',
      meterLabel: 'العروض اللي قدّمتها على الطلبات',
      capBlockTitle: 'وصلت للحد الأقصى',
      capUpgradeCta: 'حوّل لحساب متجر',
      offerSentToast: 'عرضك اتبعت للمشتري ✓',
      saveAsProduct: 'احفظه كمنتج',
      offerSentProductCreated: 'عرضك اتبعت للمشتري ✓ واتحفظ كمنتج في إعلاناتك',
      offerSentProductFailed: 'عرضك اتبعت للمشتري ✓ بس معرفناش نحفظه كمنتج، جرّب تضيفه من «إضافة إعلان»',
      productCapSkipped: 'بس المنتج متحفظش لأنك وصلت للحد الأقصى ({cap} منتجات).',
      productCapSkippedUpgrade: 'بس المنتج متحفظش لأنك وصلت للحد الأقصى ({cap} منتجات). حوّل حسابك لمتجر عشان تضيف منتجات بلا حد.',
      upgradeToStore: 'حوّل لمتجر',
      done: 'تمام',
      loginToOffer: 'سجّل دخولك الأول عشان تقدّم عرض.',
      savedTab: 'المحفوظة',
      myOffersEmpty: 'لسه ما قدّمتش أي عروض. شوف طلبات الشراء وقدّم أول عرض.',
      myOffersLoadFailed: 'مقدرناش نحمّل عروضك، جرّب تاني',
      savedLoadFailed: 'مقدرناش نحمّل العروض المحفوظة، جرّب تاني',
      offerNoArea: 'من غير منطقة',
      withdrawConfirm: 'هتسحب العرض ده؟ المشتري مش هيشوفه تاني.',
      withdrawing: 'بسحب…',
      withdrawFailed: 'معرفناش نسحب العرض، جرّب تاني',
      editSaved: 'تعديل',
      editSavedTitle: 'تعديل العرض المحفوظ',
      saveEditBtn: 'احفظ التعديل',
      savingEdit: 'بحفظ…',
      savedEditNote: 'التعديل هنا ما بيغيّرش العروض اللي اتبعتت قبل كده.',
      saveEditFailed: 'معرفناش نحفظ التعديل، جرّب تاني',
      deleteSaved: 'احذف',
      deleteSavedConfirm: 'تحذف العرض المحفوظ ده؟',
      deleteSavedFailed: 'معرفناش نحذف العرض، جرّب تاني',
      browseRequests: 'شوف طلبات الشراء',
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
    productTitle: 'Product Name',
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
    buySlotsNav: 'Buy Slots',
    promoteStoreNav: 'Promote my store',
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
    iapProductUnavailable: 'This product is currently unavailable in the App Store, please try again later',
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
    pendingUpgradeTitle: 'Upgrade request under review',
    pendingUpgradeSubtitle: 'Your upgrade will activate as soon as an admin approves the payment.',
    upgClientToStoreTitle: 'Open Your Store on Vatix',
    upgClientToStoreSubtitle: 'List unlimited products and reach thousands of daily buyers.',
    manageSubscription: 'Manage Subscription',
    storeInfo: 'Store Info',
    about: 'About',
    viewMore: 'More',
    viewLess: 'Less',
    chooseNumber: 'Choose a number to call',
    mainPhone: 'Main line',
    share: 'Share',
    socialMedia: 'Social Media',
    categoriesBrands: 'Categories & Brands',
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
    trialEndsIn: 'Trial ends in',
    daysRemaining: 'days remaining',
    daysLeftLabel: 'days',
    upgradeToStore: 'Upgrade to Store',
    upgradeNow: 'Upgrade Now',
    cancelSubscription: 'Cancel Subscription',
    cancelStore: 'Cancel Store',
    cancelStoreConfirm: 'Are you sure you want to cancel your store? Your account will revert to a client account.',
    cancelReasonPrompt: 'Before you cancel, help us understand why',
    cancelReasonRequired: 'Please choose a reason for cancelling',
    cancelReasonDetailRequired: 'Please add a short explanation (at least 2 characters)',
    cancelReasonNext: 'Next',
    cancelReasonSummaryLabel: 'Cancellation reason',
    cancelReasonExpensive: 'Too expensive',
    cancelReasonNoLead: 'No leads / customers',
    cancelReasonWrongAccount: 'Wrong account',
    cancelReasonNoNeed: "Don't need it now",
    cancelReasonNeedFeature: 'Need a missing feature',
    cancelReasonOther: 'Other reason',
    cancelReasonNeedFeatureDetail: 'Which feature do you need?',
    cancelReasonOtherDetail: 'Please specify the reason',
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
    totalViews: 'Total Interact',
    totalReach: 'Total Reach',
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
    viewsByDay: 'Interact by Day',
    reachByDay: 'Reach by Day',
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
    clientDescription: 'Buy and sell electronics as an individual.',
    storeDescription: 'Store description (optional)',
    storeLogo: 'Store logo',
    storeCover: 'Cover image (optional)',
    planCost: 'Plan cost',
    monthlyBilling: 'monthly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    perMonthSuffix: '/mo',
    perYearSuffix: '/yr',
    fromPricePrefix: 'From',
    paymentSuccessBody: 'Your subscription has been activated.',
    paymentPendingBody: 'Your payment is under review. The service will be activated once verified.',
    continueToStore: 'Continue to store',
    // Update prompt
    updateRequiredTitle: 'Update Vatix to continue',
    updateRequiredBody: 'A new version of Vatix is available with important improvements. Your account and data stay safe.',
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
    importProducts: {
      chooserTitle: 'Where are your products right now?',
      chooserSubtitle: 'Pick the easiest way to add your products.',
      optManual: 'They\'re not anywhere yet, I\'ll add them myself',
      optShopify: 'I have a Shopify store',
      optEasyOrders: 'I have an EasyOrders store',
      optExcel: 'I have an Excel sheet with my products',
      backToOptions: 'Back to add options',
      shopifyTitle: 'Import from Shopify',
      easyOrdersTitle: 'Import from Easy Orders',
      excelTitle: 'Import from Excel / CSV',
      loading: 'Loading…',
      connectedSince: 'Connected since {date}',
      disconnect: 'Disconnect',
      disconnectConfirmTitle: 'Disconnect account?',
      disconnectConfirmBody: 'Products you already imported won\'t be deleted. You can reconnect any time.',
      cancel: 'Cancel',
      defaultCategory: 'Default category',
      defaultBrand: 'Default brand',
      defaultsHint: 'Applied to every product — you can change it per product.',
      category: 'Category',
      brand: 'Brand',
      selectCategory: 'Select category',
      selectBrand: 'Select brand',
      removeRow: 'Remove from import',
      rowLabel: 'Row {row}',
      noTitle: '(untitled)',
      currency: 'EGP',
      rowsCount: '{count} products ready to import',
      noRows: 'No products to import.',
      skippedExisting: '{n} products skipped — already imported',
      errorsHeading: 'Errors',
      loadMore: 'Load more',
      confirmBtn: 'Confirm & import {count} products',
      saving: 'Saving…',
      importedTitle: 'Imported',
      importedBody: 'Imported {count} products successfully.',
      pickCategoryForEachRow: 'Pick a category for every product to continue.',
      pickBrandForEachRow: 'Pick a brand for every product to continue.',
      fixErrors: 'Please fix the errors in your file and re-upload.',
      loadFailed: 'Could not load products. Please try again.',
      saveFailed: 'Save failed',
      rateLimited: 'Rate limit exceeded. Try again in {seconds} seconds.',
      categoryNotFound: 'Category not found on row {row}.',
      brandNotFound: 'Brand not found on row {row}.',
      capReached: 'You\'ve reached your listing limit. Buy extra slots to continue.',
      capReachedError: 'This import is bigger than your remaining allowance (limit {cap} listings). Buy extra slots or convert to a store.',
      capTitle: 'Your listing allowance',
      capUsed: '{count} of {cap} listings',
      capRemaining: '{remaining} left',
      capFull: 'Limit reached',
      capHint: 'Personal accounts have a lifetime limit of {cap} listings. Buy extra slots or convert to a store with no limit.',
      capBuySlots: 'Buy extra slots',
      capConvertStore: 'Convert to a store',
      capStoreTrialHint: 'Stores have unlimited listings — {days}-day free trial the first time.',
      ok: 'OK',
      shopLabel: 'Shopify store domain',
      shopPlaceholder: 'my-store',
      shopHint: 'Type your store name as it appears in your myshopify.com link.',
      shopInvalid: 'Invalid store name.',
      shopConnectBtn: 'Connect Shopify',
      shopConnectedTo: 'Connected to {shop}',
      shopLoadBtn: 'Load products from Shopify',
      shopReconnectNeeded: 'Your Shopify connection has expired. Please reconnect to continue.',
      shopFirstBatchHint: 'Showing the first 50 products. Import, then load again to import the rest.',
      eoConnectLabel: 'Connect your Easy Orders account',
      eoApiKeyLabel: 'Api-Key',
      eoApiKeyPlaceholder: 'Paste your Easy Orders Api-Key',
      eoApiKeyRequired: 'Please enter a valid Api-Key.',
      eoConnectBtn: 'Connect Easy Orders',
      eoConnected: 'Connected to Easy Orders',
      eoLoadBtn: 'Load products from Easy Orders',
      eoReconnectNeeded: 'Your Easy Orders connection has expired. Please reconnect to continue.',
      eoInvalidKey: 'Invalid Easy Orders Api-Key. Check your dashboard and try again.',
      eoMissingPermission: 'This Api-Key lacks permission to read products. Enable the products permission for the key in Easy Orders and try again.',
      eoUpstreamError: 'Can\'t reach Easy Orders right now. Please try again later.',
      eoStepsTitle: 'How to get your Api-Key',
      eoStep1: 'In your Easy Orders dashboard, open Settings.',
      eoStep2: 'Choose Public API from the menu.',
      eoStep3: 'Tap Create (إنشاء) to create a new API key.',
      eoStep4: 'Check the "list all products" permission, then save.',
      eoStep5: 'Copy the key, paste it here, and press Connect Easy Orders.',
      eoOpenDashboard: 'Open Easy Orders dashboard',
      excelSubtitle: 'Upload an Excel (.xlsx) or CSV file with your products to preview before saving.',
      excelPickBtn: 'Choose an Excel or CSV file',
      excelChangeFile: 'Change file',
      excelTemplate: 'Download CSV template',
      excelTemplateHint: 'The images column holds pipe-separated (|) URLs; category and brand are picked after upload.',
      excelXlsUnsupported: 'Legacy .xls files are not supported. Save the file as .xlsx or CSV.',
      excelUnsupported: 'Please choose a .xlsx or .csv file.',
      excelReadFailed: 'Could not read the file.',
      excelEmpty: 'The file is empty.',
      mapHeading: 'Map your columns',
      mapTitle: 'Title',
      mapDescription: 'Description',
      mapPrice: 'Price',
      mapImages: 'Images',
      mapNone: '— None —',
      mapPlaceholder: '— Select column —',
      mapRequiredHint: 'Map the required columns (title, price) to continue.',
      previewBtn: 'Preview',
      uploadFailed: 'Upload failed',
    },
    subscriptionExpiring: {
      title: 'Your subscription is expiring soon',
      body: 'Your store subscription expires on {date}. For automatic renewal, make sure your wallet has enough balance before then.',
      walletBalance: 'Current wallet balance',
      topUpCta: 'Top up wallet now',
      laterCta: 'Later',
    },
    usePromoCreditsDialog: {
      title: 'You have unused promotion credits',
      body: 'Use your promotion credits to push a listing to the top of search results for 7 days.',
      creditsLabel: 'Credits available',
      cta: 'Promote a listing now',
      dismiss: 'Later',
    },
    storeCategoriesBrandsDialog: {
      title: "🏷️ Enhance your store's visibility",
      hookLine: "Your store isn't tagged with any categories or brands yet",
      body: 'Pick the categories and brands your store deals with so we can surface it to interested customers and boost your visibility.',
      cta: '✨ Select categories & brands',
      dismiss: 'Later',
    },
    categoriesBrandsPage: {
      headline: 'Categories & Brands',
      description: 'Choose the categories and brands your store carries so we can help interested customers discover you.',
      loading: 'Loading...',
      categoriesLabel: 'Categories',
      brandsLabel: 'Brands',
      selectedLabel: 'selected',
      noCategories: 'No categories available right now',
      noBrands: 'No brands available right now',
      saveButton: 'Save Changes',
      saving: '⏳ Saving...',
      savedSuccess: 'Preferences saved successfully ✓',
      saveError: 'Save failed',
    },
    rateApp: {
      title: 'Enjoying Vatix?',
      body: 'Your feedback matters. If you love the experience, rate us on the store — if not, tell us what could be better.',
      positiveCta: 'Yes, rate it',
      negativeCta: 'Send feedback',
    },
    buySlots: {
      navLabel: 'Extra Ad Slots',
      heading: 'Buy Extra Ad Slots 🎟',
      description: 'Each extra slot permanently raises your listing cap — it never expires.',
      extraSlotsOwned: 'Extra Ad Slots Owned',
      permanentSlot: 'permanent slot',
      walletBalance: 'Wallet Balance',
      loading: 'Loading...',
      noBundles: 'No bundles available right now.',
      perSlotPermanent: 'EGP / slot · permanent',
      buyArrow: 'Buy →',
      extraSlotsPermanentSuffix: ' extra slots · permanent',
      capReachedTitle: 'Listing cap reached',
      capReachedBody: "You've used all your available ad slots. Buy extra slots to finish posting your listing.",
      capReachedCta: 'Buy extra slots',
      choosePaymentMethod: 'Choose payment method:',
      payWithWallet: 'Pay from Wallet',
      payWithWalletNote: 'Amount is deducted from your wallet balance instantly.',
      insufficientWallet: 'Insufficient wallet balance',
      instantTransfer: 'Instant Transfer',
      mobileWallet: 'Mobile Wallet',
      walletsListed: 'Vodafone · Etisalat · WE',
      applePayCta: 'Pay with Apple',
      applePayProcessing: 'Processing payment…',
      cancelPayment: 'Cancel',
      yourPhone: 'Your Phone *',
      phonePlaceholder: '01xxxxxxxxx',
      transferReceiptPhoto: 'Transfer Receipt Photo *',
      imageHint: 'JPG · PNG · clear image',
      sendReceipt: 'Send Receipt',
      submitting: 'Submitting…',
      missingScreenshot: 'Please upload the receipt photo',
      missingPhone: 'Please enter your phone number',
      requestReceivedTitle: 'Request Received!',
      withinHours: 'Vatix team will review the transfer and add your extra slots within 24 hours.',
      finishAfterApproval: 'You can finish posting your ad after approval.',
      addListing: 'Add Listing',
      buyAnotherPack: 'Buy Another Pack →',
      paymentSuccessTitle: 'Payment Successful!',
      walletDeductedBody: 'Amount deducted from your wallet and extra slots added instantly.',
      appleSuccessBody: 'Apple Pay confirmed and extra slots added instantly.',
      extraSlotsOwnedLabel: 'Extra slots owned:',
      remainingWalletBalance: 'Remaining wallet balance:',
      redirectingToListing: 'Redirecting to continue your listing…',
      continueImporting: 'Continue importing',
      redirectingToImport: 'Redirecting to continue your import…',
      finishImportAfterApproval: 'You can finish importing after approval.',
      paymentFailed: 'Payment failed, please try again',
    },
    promoteStore: {
      heading: 'Promote my store ⭐',
      description: 'Your store is listed first in the stores list with a "Featured" badge for the whole promotion period. Your store appears first in the featured stores strip on product pages. Buying again extends it.',
      offerSummary: '{price} EGP · {days} days',
      activeUntil: 'Your store is featured until {date}',
      notPromoted: 'Your store is not featured right now',
      loadError: "Couldn't load the promotion offer. Please try again.",
      retry: 'Retry',
      storesOnly: 'Store promotion is available to stores only.',
      renewFirst: 'Renew your subscription before promoting your store.',
      comingSoon: 'Coming soon',
      promoteAgain: 'Extend promotion →',
      promotedUntilLabel: 'Featured until:',
      withinHours: 'Vatix team will review the transfer and activate your store promotion within 24 hours.',
      walletDeductedBody: 'Amount deducted from your wallet and your store promotion is active.',
      appleSuccessBody: 'App Store payment confirmed and your store promotion is active.',
      backToDashboard: 'Back to dashboard',
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
      optionAppleTitle: 'Pay with Apple',
      appleProcessing: 'Processing payment…',
      optionAppleDesc: 'Renew instantly through the App Store',
      appleDoneTitle: 'Subscription activated',
      appleDoneBody: 'Your subscription has been renewed. Signing you in now.',
    },
    bro: {
      // Identity
      name: 'Geeko', badge: 'Official Vatix assistant', navLink: 'Geeko', pillLabel: 'Let Geeko find it for me',
      // Product page card (B) + sticky bar
      chipCheaper: '💸 Cheaper than {price}', chipBetter: '✨ Better condition', chipBox: '📦 With box',
      ctaFind: '🔍 Find me the same one', stickyCta: 'VB · Find me the same one →',
      // Sold-listing takeover (C)
      soldTitle: 'This ad is sold 😕 but Geeko can find you the same one', ctaFindAvailable: '🔍 Find me an available one',
      // Entry points
      heroStrip: 'Cannot find what you want? Let Geeko search for you', searchEmptyTitle: 'Did not find what you are looking for?',
      searchEmptyBody: 'Geeko asks sellers for you and comes back with what is actually available.', searchEmptyCta: '🔍 Find me {model}',
      // Intake form
      intakeTitle: 'Tell Geeko what you want', stepCategory: 'Category', stepBrand: 'Brand', stepModel: 'Model',
      stepStorage: 'Storage', stepArea: 'Area', stepBudget: 'Budget',
      optional: 'Optional', required: 'Required', modelPlaceholder: 'e.g. iPhone 15 Pro', storagePlaceholder: 'e.g. 256',
      budgetMin: 'From', budgetMax: 'Up to', wantsLabel: 'How would you like it?',
      wantCheaper: '💸 Cheaper', wantBetterCondition: '✨ Better condition', wantWithBox: '📦 With box',
      knownFromSearch: '✓ Picked up from your search', edit: 'Edit',
      submit: '🚀 Go Geeko, search', submitting: 'Searching…',
      intakeFooter: '🔒 Geeko tells sellers he is a Vatix assistant asking for a real buyer, and never shares your number or name until you contact the seller yourself.',
      errModelRequired: 'Enter the model name', errAreaRequired: 'Choose an area', errBudgetRange: 'Minimum budget must be lower than maximum budget',
      intakeLoadFailed: 'We could not load the categories and areas, try again', errCategoryRequired: 'Choose a category', areaPlaceholder: 'Choose an area',
      // Request page
      askingProgress: 'Asking {asked} sellers… {available} confirmed',
      pillAvailable: '✓ Available', pillSold: '✕ Sold', pillPending: '⏳ Still replying',
      sectionAvailable: 'Available now', sectionSold: 'Sold · hidden',
      cheapestRibbon: '⭐ Cheapest', priceDrop: 'Down {amount}', priceEgp: 'EGP {price}',
      chatSeller: '💬 Chat with seller', viewAd: 'View ad', connecting: 'Opening the chat…',
      stopSearch: 'Stop searching', rerun: 'Search again',
      foundButton: 'I already found a device', searchingUntil: 'Searching until {date}',
      noCandidatesYet: 'No sellers have it yet — I’ll look again every day.',
      emptyTitle: 'Nothing found right now', widenArea: 'Widen the area', dropBudget: 'Remove the budget',
      // Requests list
      listTitle: 'My Geeko requests', listEmpty: 'No requests yet. Tell Geeko what you want and he will search for you.', newRequest: 'New request',
      tabLabel: 'Bro', foundTitle: 'Geeko finds', foundSubtitle: 'Devices sellers confirmed are available', foundEmpty: 'Geeko has not found any devices yet. Once a seller confirms a device is available it shows up here.', foundForRequest: 'For: {model}', allRequests: 'All my requests',
      statusSearching: 'Searching', statusDone: 'Done', statusExpired: 'Expired', statusCancelled: 'Cancelled', statusFound: 'Found one',
      // Match facts grid
      factAvailable: 'Available · confirmed {ago}', factArea: 'Check-up in {area}', factWarranty: 'Warranty: {note}',
      scratchesNone: 'Flawless', scratchesMinor: 'Minor scratch', scratchesRepaired: 'Repaired',
      extraBox: 'Box', extraInvoice: 'Invoice', extraWarranty: 'Warranty',
      sellerQuote: 'Seller says: “{note}”',
      agoNow: 'just now', agoMinutes: '{n} min ago', agoHours: '{n} h ago', agoDays: '{n} d ago',
      // Seller side (chat + /bro/i/[id])
      sellerDisclosure: '🤖 This is the automated Vatix assistant. A real buyer in {area} is interested in your ad. Your number is only shared if the buyer contacts you themselves.',
      sellerAsk: 'Hi 👋 a buyer is looking for exactly this device. Is it still available?',
      qrAvailable: '✅ Available', qrSold: '❌ Sold', qrWrongModel: '🔄 Wrong model', qrOwnReply: '💬 I will reply myself',
      formIntro: 'Great 🙏 two quick questions so the buyer can decide:',
      fieldLatestPrice: 'Latest price (EGP)', fieldCheckArea: 'Check-up area', fieldScratches: 'Device condition', fieldExtras: 'Comes with',
      fieldWarrantyNote: 'Warranty details (optional)', fieldNote: 'Note to the buyer (optional)',
      freeTextPlaceholder: 'Type your reply here', sellerSend: 'Send', formComposerHint: 'Fill in the form above to reply 👆',
      sellerThanks: 'Thanks! Your reply was sent to the buyer ✨ If they want to talk to you it will show up here.',
      priceUpdatePrompt: '💡 Update your ad price to {price} EGP?', soldConfirmPrompt: 'Mark it as sold?',
      yes: 'Yes', no: 'No',
      optOutPrompt: 'Do not want messages from Geeko?', optOutAction: 'Stop', optOutDone: 'Done, you will not get Geeko messages anymore.',
      optInAction: 'Turn messages back on', sellerLoginRequired: 'Log in first to reply to the buyer.',
      sellerNotFound: 'This request does not exist or is not yours.',
      sellerLinkNotYours: 'This link is not yours', sellerLoadFailed: 'We could not load the request, try again', retry: 'Try again', loading: 'Loading…',
      sellerPageTitle: 'A buyer is interested in your ad', sellerBuyerArea: 'The buyer is in {area}',
      sellerStatusAvailable: '✅ You replied it is available', sellerStatusSold: '❌ You replied it is sold',
      sellerStatusClosed: 'This request is closed and needs no reply', sellerYourReply: 'Your reply: “{text}”',
      sellerOpenChat: '💬 Open the chat',
      // Notifications
      notifStarted: 'I started searching ✅ I will message you as soon as someone confirms.',
      notifFound: 'I found {n} {model} available in {area} 🎉 The cheapest is EGP {price}…',
      notifNone: 'Nothing available this time 😕 Want me to search again or widen the area?',
      // Backend error messages (shown verbatim when the API returns them)
      errRateLimit: 'You have reached the Bro request limit for now, try again in a bit',
      errSearchDown: 'Search is unavailable right now, try again shortly', errDisabled: 'Geeko is not available right now',
      errNotFound: 'Request not found', errFinished: 'This request is already finished', errStillRunning: 'You cannot re-run a request that is still running',
      errNotConfirmed: 'The seller has not confirmed the ad is available yet', errNoLongerAvailable: 'This ad is no longer available',
      errGeneric: 'Something went wrong, try again',
      errPrice: 'Enter a valid price (up to 2 decimals)',
      // Feature-off page (/bro/new when Bro is disabled)
      unavailableTitle: 'Geeko is not available right now', unavailableBody: 'The service is temporarily off, please try again in a bit.', unavailableHome: 'Back to home',
      // Requests board + seller offers
      browseProducts: 'Browse products',
      foundNavLink: 'Geeko finds',
      requestsNav: 'Buy requests',
      fabChooserTitle: 'What would you like to do?',
      fabPostProduct: 'Post a product',
      fabPostProductSub: 'List a device you want to sell',
      fabPostRequest: 'Request a device',
      fabPostRequestSub: 'Tell Geeko what you need and sellers send you offers',
      makeOffer: 'Make an offer',
      makeOfferAgain: 'Send a new offer',
      offerSent: 'Your offer was sent ✓',
      badgeSearching: 'Geeko is searching',
      badgeOpen: 'Open',
      badgeNew: 'New',
      meter: '{used} of {cap} · resets at the start of the month',
      tabFromProducts: 'From my products',
      tabScratch: 'New offer',
      tabSaved: 'My saved offers',
      saveOffer: 'Save this offer',
      offersSection: '🙋 Offers from sellers ({n})',
      tagOffer: 'Offer',
      tagBro: 'Geeko',
      tagOfferBro: 'Offer · Geeko',
      cheapest: 'Cheapest',
      unavailable: 'Unavailable',
      broFoundSection: '🔎 Found by Geeko',
      stripDone: 'Geeko finished searching · your request stays on the requests page until {date}',
      markFound: 'Mark as found',
      searchAgain: 'Search again',
      stateActive: 'Active',
      stateClosed: 'Closed',
      stateUnavailable: 'Unavailable',
      stateWithdrawn: 'Withdrawn',
      myOffersTitle: 'My offers',
      withdraw: 'Withdraw offer',
      capReached: 'You\'ve reached this month\'s offer limit. It resets on {date}.',
      upgradeNudge: 'Want to make unlimited offers? Upgrade your account to a store.',
      boardTitle: 'Buy requests',
      boardAskGeeko: 'Request a device by Geeko',
      boardSubtitle: 'Buyers are looking for devices right now. Make your offer and chat with them.',
      boardAllCategories: 'All categories',
      boardAllAreas: 'All areas',
      boardFilterAreaPlaceholder: 'Area',
      boardFilterCategoryPlaceholder: 'Category',
      boardAllBrands: 'All brands',
      boardFilterBrandPlaceholder: 'Brand',
      boardCountOne: '1 request',
      boardCountTwo: '2 requests',
      boardCountFew: '{n} requests',
      boardCountMany: '{n} requests',
      boardClearFilters: 'Clear filters',
      boardEmpty: 'There are no open requests right now. Check back soon.',
      boardLoadFailed: 'We couldn\'t load the requests, please try again',
      boardLoadMore: 'Load more',
      boardLoadingMore: 'Loading…',
      budgetRange: 'Budget: {min} – {max} EGP',
      budgetUpTo: 'Budget: up to {max} EGP',
      budgetFrom: 'Budget: from {min} EGP',
      offersCount: '{n} offers',
      offersCountOne: '1 offer',
      offersCountNone: 'No offers yet',
      cardInArea: 'in {area}',
      budgetLabel: 'Budget',
      budgetAmtRange: '{min} – {max}',
      budgetAmtUpTo: 'up to {max}',
      budgetAmtFrom: 'from {min}',
      budgetCurrency: 'EGP',
      budgetOpen: 'Open — name your price',
      anyCondition: 'Any condition works',
      firstOfferHint: '🔥 Be the first to make an offer',
      storageUnit: 'GB',
      sortNewest: 'Newest',
      sortBudget: 'Highest budget',
      allCategories: 'All',
      sheetTitle: 'Make your offer',
      sheetFor: 'For request: {model}',
      sheetClose: 'Close',
      sheetLoadFailed: 'We couldn\'t load the data, please try again',
      sheetNotFound: 'This request is no longer open for offers',
      offerOpenFailed: 'We couldn\'t open this request. Please try again',
      pickProduct: 'Pick one of your listings',
      noProducts: 'You have no available listings. Create a new offer from the other tab.',
      noSavedOffers: 'No saved offers yet. Save one from the "New offer" tab.',
      useThis: 'Use this',
      savedUnavailableHint: 'The listing linked to this offer is no longer available',
      backToList: 'Back to list',
      offerTitleLabel: 'Offer title',
      offerTitlePlaceholder: 'e.g. iPhone 15 Pro 256 like new',
      offerPriceLabel: 'Price (EGP)',
      offerAreaLabel: 'Meeting area',
      offerAreaPlaceholder: 'Choose an area (optional)',
      areasLoadFailed: 'We couldn\'t load the areas',
      offerPhotosLabel: 'Device photos',
      offerPhotosHint: 'Up to {max} photos',
      addPhotos: 'Add photos',
      uploadingPhotos: 'Uploading photos…',
      removePhoto: 'Remove photo',
      photosUploadFailed: 'We couldn\'t upload the photos, please try again',
      offerSubmit: 'Send offer',
      offerSubmitting: 'Sending…',
      errOfferTitle: 'Enter a title for the offer',
      errOfferPrice: 'Enter a price above zero (up to two decimals)',
      meterLabel: 'Offers you made on requests',
      capBlockTitle: 'You\'ve reached the limit',
      capUpgradeCta: 'Upgrade to a store account',
      offerSentToast: 'Your offer was sent to the buyer ✓',
      saveAsProduct: 'Save as a product',
      offerSentProductCreated: 'Your offer was sent ✓ and saved as a product in your ads',
      offerSentProductFailed: 'Your offer was sent ✓ but we couldn\'t save it as a product. Try adding it from “Post ad”',
      productCapSkipped: 'The product wasn\'t saved because you reached the limit ({cap} products).',
      productCapSkippedUpgrade: 'The product wasn\'t saved because you reached the limit ({cap} products). Convert to a store to add unlimited products.',
      upgradeToStore: 'Convert to store',
      done: 'OK',
      loginToOffer: 'Log in first to make an offer.',
      savedTab: 'Saved',
      myOffersEmpty: 'You have not made any offers yet. Browse buy requests and make your first one.',
      myOffersLoadFailed: 'We could not load your offers, try again',
      savedLoadFailed: 'We could not load your saved offers, try again',
      offerNoArea: 'No area',
      withdrawConfirm: 'Withdraw this offer? The buyer will no longer see it.',
      withdrawing: 'Withdrawing…',
      withdrawFailed: 'We could not withdraw the offer, try again',
      editSaved: 'Edit',
      editSavedTitle: 'Edit saved offer',
      saveEditBtn: 'Save changes',
      savingEdit: 'Saving…',
      savedEditNote: 'Editing here does not change offers you already sent.',
      saveEditFailed: 'We could not save your changes, try again',
      deleteSaved: 'Delete',
      deleteSavedConfirm: 'Delete this saved offer?',
      deleteSavedFailed: 'We could not delete the offer, try again',
      browseRequests: 'Browse buy requests',
    },
  },
}
