import { PrismaClient } from '@prisma/client';

export async function seedPackages(prisma: PrismaClient) {
  console.log('Seeding packages...');

  await prisma.bookingPackage.deleteMany();
  await prisma.packageTest.deleteMany();
  await prisma.healthPackage.deleteMany();

  const allTests = await prisma.test.findMany();
  const findTest = (name: string) => allTests.find((t) => t.name === name);

  const packages = [
    {
      name: 'SevaCheck Basic', subtitle: 'First-timers · Young Adults',
      category: 'Basic', categoryId: 'basic',
      price: 449, oldPrice: 1000, discount: '55% OFF', parametersCount: 46,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Ideal for young adults tracking basic health benchmarks.',
      preparation: 'Fasting of 8-10 hours is mandatory. Drinking water is permitted.',
      displayOrder: 1,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'Urine Routine & Microscopy', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)'],
    },
    {
      name: 'SevaCheck Plus', subtitle: 'Adults 25–45 · Annual Screen',
      category: 'Plus', categoryId: 'plus',
      price: 749, oldPrice: 1800, discount: '58% OFF', parametersCount: 54,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Comprehensive basic checkup including blood sugar and thyroid status.',
      preparation: '8-12 hours overnight fasting required.',
      displayOrder: 2,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'HbA1c – 3-Month Average', 'Thyroid Profile T3/T4/TSH', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)', 'Urine Routine & Microscopy'],
    },
    {
      name: 'SevaCheck Complete', subtitle: 'Adults 30–55 · Most Popular',
      category: 'Complete', categoryId: 'complete',
      price: 1149, oldPrice: 2800, discount: '59% OFF', parametersCount: 73,
      badge: 'BEST SELLER',
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      isFeatured: true, isPopular: true,
      description: 'Our most comprehensive screening covering key organs and metrics.',
      preparation: 'Strict overnight fasting of minimum 10 hours is mandatory.',
      displayOrder: 3,
      testNames: ['Complete Blood Count (CBC)', 'ESR (Westergren Method)', 'Urine Routine & Microscopy', 'Blood Sugar Fasting', 'HbA1c – 3-Month Average', 'Thyroid Profile T3/T4/TSH', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)', 'Calcium Test'],
    },
    {
      name: 'SevaCheck Advanced', subtitle: 'Adults 40+ · Chronic Monitoring',
      category: 'Advanced', categoryId: 'advanced',
      price: 1649, oldPrice: 3800, discount: '57% OFF', parametersCount: 81,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Advanced overview including crucial vitamin counts and electrolyte levels.',
      preparation: 'Do not take vitamin supplements 24 hours prior. 10-12 hrs fast.',
      displayOrder: 4,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'HbA1c – 3-Month Average', 'Thyroid Profile T3/T4/TSH', 'Anti TPO Antibody', 'Lipid Profile (7 param)', 'CRP (Cardiac Risk)', 'Liver Function Test (LFT)', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)', 'Iron Profile', 'Insulin Fasting', 'Peripheral Smear Examination', 'Blood Group & Rh Typing'],
    },
    {
      name: 'SevaCheck Elite', subtitle: 'Most Comprehensive · 95+ Param',
      category: 'Elite', categoryId: 'elite',
      price: 2449, oldPrice: 5500, discount: '55% OFF', parametersCount: 95,
      badge: 'PREMIUM',
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      isFeatured: true,
      description: 'Elite executive evaluation. Perfect for ultimate body analytics.',
      preparation: '12 Hours strict fasting. Avoid heavy exercise or high-fat meal the day before.',
      displayOrder: 5,
      testNames: ['Complete Blood Count (CBC)', 'ESR (Westergren Method)', 'Urine Routine & Microscopy', 'Peripheral Smear Examination', 'Blood Group & Rh Typing', 'Blood Sugar Fasting', 'HbA1c – 3-Month Average', 'Blood Sugar PP', 'Insulin Fasting', 'Thyroid Free FT3/FT4/TSH', 'Anti TPO Antibody', 'Lipid Profile (7 param)', 'Troponin I', 'CRP (Cardiac Risk)', 'Liver Function Test (LFT)', 'Bilirubin Total/Direct', 'SGPT (ALT)', 'Hepatitis B Surface Antigen', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)', 'Iron Profile', 'Calcium Test'],
    },
    {
      name: 'SevaWoman', subtitle: 'Women 20–55 · Hormones & Thyroid',
      category: 'Women', categoryId: 'women',
      price: 1449, oldPrice: 3200, discount: '55% OFF', parametersCount: 88,
      badge: 'FOR HER',
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      isFeatured: true,
      description: 'Custom formulated for female hormonal profiling and vital tracking.',
      preparation: 'Preferably tested on Day 2 or Day 3 of Menstrual Cycle. 10 hours fast.',
      displayOrder: 6,
      testNames: ['Complete Blood Count (CBC)', 'Thyroid Profile T3/T4/TSH', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)', 'Iron Profile', 'Calcium Test', 'Lipid Profile (7 param)'],
    },
    {
      name: 'SevaMan', subtitle: 'Men 25–55 · Testosterone & Heart',
      category: 'Men', categoryId: 'men',
      price: 1449, oldPrice: 3200, discount: '55% OFF', parametersCount: 82,
      badge: 'FOR HIM',
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Engineered for men to track hormonal health, vitality, and organ efficiency.',
      preparation: 'Best done via early morning fasting blood collection (8 AM to 10 AM).',
      displayOrder: 7,
      testNames: ['Complete Blood Count (CBC)', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)', 'Blood Sugar Fasting', 'Thyroid Profile T3/T4/TSH', 'CRP (Cardiac Risk)'],
    },
    {
      name: 'SevaSenior 60+', subtitle: 'Senior Citizens · 60 Years & Above',
      category: 'Senior Citizen', categoryId: 'senior_citizen',
      price: 1749, oldPrice: 4000, discount: '56% OFF', parametersCount: 91,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Senior protective screening ensuring bone stability, cardiac health, and immunity metrics.',
      preparation: 'Rest properly prior to sample collection. Inform your regular medications.',
      displayOrder: 8,
      testNames: ['Complete Blood Count (CBC)', 'ESR (Westergren Method)', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)', 'HbA1c – 3-Month Average', 'Thyroid Profile T3/T4/TSH', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)', 'Calcium Test', 'CRP (Cardiac Risk)'],
    },
    {
      name: 'SevaCouple', subtitle: 'Couples · Annual Screening × 2',
      category: 'Couple', categoryId: 'couple',
      price: 1949, oldPrice: 5600, discount: '65% OFF', parametersCount: 73,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Ultimate preventative screening discounted for couples sharing home visits.',
      preparation: 'Requires fasting for both individuals.',
      displayOrder: 9,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'Lipid Profile (7 param)', 'Thyroid Profile T3/T4/TSH', 'Liver Function Test (LFT)'],
    },
    {
      name: 'SevaYouth Under 30', subtitle: 'Young Adults 18–30 · First Screen',
      category: 'Youth', categoryId: 'youth',
      price: 549, oldPrice: 1200, discount: '54% OFF', parametersCount: 48,
      badge: 'NEW',
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Affordable, entry-level wellness dashboard covering lifestyle stress markers.',
      preparation: '10 hours fasting. Drink plenty of water.',
      displayOrder: 10,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'Lipid Profile (7 param)', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)'],
    },
    {
      name: 'SevaAdult 30–45', subtitle: 'Mid-Adults · Most At Risk Age',
      category: 'Adult', categoryId: 'adult',
      price: 849, oldPrice: 1900, discount: '55% OFF', parametersCount: 62,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Proactive check tailored for busy mid-career professionals.',
      preparation: '8-12 hours fasting required. No heavy alcohol 24h prior.',
      displayOrder: 11,
      testNames: ['Complete Blood Count (CBC)', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)', 'Blood Sugar Fasting', 'Thyroid Profile T3/T4/TSH', 'Vitamin D Total (25-OH)', 'CRP (Cardiac Risk)'],
    },
    {
      name: 'SevaMidlife 45–60', subtitle: 'Pre-Senior Preventive Care',
      category: 'Midlife', categoryId: 'midlife',
      price: 1349, oldPrice: 3000, discount: '55% OFF', parametersCount: 76,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Specialized transition healthcare identifying hormonal shifts and deficiencies.',
      preparation: '12 hours fasting is mandatory. Continue scheduled critical medicines.',
      displayOrder: 12,
      testNames: ['Complete Blood Count (CBC)', 'Lipid Profile (7 param)', 'Liver Function Test (LFT)', 'HbA1c – 3-Month Average', 'Thyroid Profile T3/T4/TSH', 'Vitamin D Total (25-OH)', 'Vitamin B12 (Cobalamin)', 'Calcium Test', 'CRP (Cardiac Risk)'],
    },
    {
      name: 'SevaDiabetes Care', subtitle: 'Diabetes · 3-Month Monitoring',
      category: 'Diabetes Care', categoryId: 'diabetes_care',
      price: 849, oldPrice: 1900, discount: '55% OFF', parametersCount: 38,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Gold standard monitoring package checking sugar control and organ implications.',
      preparation: 'Take morning fasting sample, consume standard breakfast, then collect PP sample after 2 hours.',
      displayOrder: 13,
      testNames: ['Blood Sugar Fasting', 'HbA1c – 3-Month Average', 'Blood Sugar PP', 'Insulin Fasting', 'Urine Routine & Microscopy', 'Liver Function Test (LFT)'],
    },
    {
      name: 'SevaHeart Care', subtitle: 'Cardiac Patients · High-Risk Adults',
      category: 'Heart Care', categoryId: 'heart_care',
      price: 1249, oldPrice: 2800, discount: '55% OFF', parametersCount: 44,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Assessing cardiac strain levels, blockage risk markers, and metabolic states.',
      preparation: 'Strictly 12 hours fasting. Avoid high fat meals 48 hours prior.',
      displayOrder: 14,
      testNames: ['Lipid Profile (7 param)', 'Troponin I', 'CRP (Cardiac Risk)', 'Complete Blood Count (CBC)', 'Blood Sugar Fasting'],
    },
    {
      name: 'SevaThyroid Advanced', subtitle: 'Thyroid Patients · 5-Marker Panel',
      category: 'Thyroid Care', categoryId: 'thyroid_care',
      price: 849, oldPrice: 1800, discount: '53% OFF', parametersCount: 5,
      reportTime: '24 Hours', fastingRequired: false, homeCollection: true,
      description: 'Complete immunological evaluation detecting Hashimoto\'s, Graves, and thyroid errors.',
      preparation: 'Do not take thyroid hormone medication before the morning blood draw.',
      displayOrder: 15,
      testNames: ['Thyroid Profile T3/T4/TSH', 'Thyroid Free FT3/FT4/TSH', 'TSH Ultra Sensitive', 'Anti TPO Antibody'],
    },
    {
      name: 'SevaFever Panel', subtitle: 'Fever Workup · Unknown Origin',
      category: 'Fever Care', categoryId: 'fever_care',
      price: 949, oldPrice: 2200, discount: '57% OFF', parametersCount: 28,
      reportTime: '24 Hours', fastingRequired: false, homeCollection: true,
      isTrending: true,
      description: 'Expedited viral, parasitic, and bacterial fever panel.',
      preparation: 'No special preparation. Can be booked 24/7 for urgent fever investigation.',
      displayOrder: 16,
      testNames: ['Dengue Duo NS1+IgG+IgM', 'Typhoid Rapid Test', 'Malaria PF/PV Rapid', 'CRP Quantitative', 'Complete Blood Count (CBC)', 'ESR (Westergren Method)'],
    },
    {
      name: 'SevaAnemia Care', subtitle: 'Iron Deficiency · Low Hemoglobin',
      category: 'Anemia Care', categoryId: 'anemia_care',
      price: 649, oldPrice: 1400, discount: '54% OFF', parametersCount: 18,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Ideal for patients experiencing chronic fatigue or verified low Hemoglobin.',
      preparation: 'Overnight fasting 10-12 hours. Avoid iron supplements 24 hours before.',
      displayOrder: 17,
      testNames: ['Complete Blood Count (CBC)', 'Iron Profile', 'Vitamin B12 (Cobalamin)', 'Peripheral Smear Examination'],
    },
    {
      name: 'SevaPregnancy Panel', subtitle: 'Pregnant Women · Antenatal Profile',
      category: 'Pregnancy', categoryId: 'pregnancy',
      price: 1849, oldPrice: 4200, discount: '56% OFF', parametersCount: 32,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Essential 1st/2nd Trimester panel assessing infant transmission risks and maternal strength.',
      preparation: 'Fasting recommended. Collect first morning clean catch urine sample.',
      displayOrder: 18,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'Thyroid Profile T3/T4/TSH', 'Urine Routine & Microscopy', 'Blood Group & Rh Typing', 'HbA1c – 3-Month Average'],
    },
    {
      name: 'SevaFertility Women', subtitle: 'Women Trying to Conceive · AMH+',
      category: 'Fertility Women', categoryId: 'fertility_women',
      price: 1749, oldPrice: 3900, discount: '55% OFF', parametersCount: 22,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Determining ovarian reserve values (AMH) and baseline conception hormones.',
      preparation: 'Strictly recommended on Day 2, 3 or 4 of Menstrual cycle. 10 hours fasting.',
      displayOrder: 19,
      testNames: ['Thyroid Profile T3/T4/TSH', 'Blood Sugar Fasting', 'Vitamin D Total (25-OH)', 'Complete Blood Count (CBC)'],
    },
    {
      name: 'SevaFertility Men', subtitle: 'Men Fertility Assessment · SA+',
      category: 'Fertility Men', categoryId: 'fertility_men',
      price: 1449, oldPrice: 3200, discount: '55% OFF', parametersCount: 18,
      reportTime: '24 Hours', fastingRequired: true, homeCollection: true,
      description: 'Key andrology analytics combined with foundational male metabolic metrics.',
      preparation: 'Semen sample requires 3-5 days of sexual abstinence before collection. Blood needs fasting.',
      displayOrder: 20,
      testNames: ['Complete Blood Count (CBC)', 'Blood Sugar Fasting', 'Thyroid Profile T3/T4/TSH', 'Vitamin D Total (25-OH)'],
    },
  ];

  for (const pkg of packages) {
    const { testNames, ...pkgData } = pkg;
    const createdPkg = await prisma.healthPackage.create({ data: pkgData });

    for (const testName of testNames) {
      const test = findTest(testName);
      if (test) {
        await prisma.packageTest.create({
          data: { packageId: createdPkg.id, testId: test.id },
        });
      } else {
        console.warn(`Test not found for package "${pkg.name}": ${testName}`);
      }
    }
  }

  console.log(`Packages seeded (${packages.length} packages with linked tests)`);
}