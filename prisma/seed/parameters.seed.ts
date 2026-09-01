import { PrismaClient } from '@prisma/client';

export async function seedParameters(prisma: PrismaClient) {
  console.log('Seeding test parameters...');

  const tests = await prisma.test.findMany({ select: { id: true, name: true } });
  const byName = (name: string) => {
    const t = tests.find(t => t.name === name);
    if (!t) throw new Error(`Test not found: ${name}`);
    return t.id;
  };

  const parameters: { testId: string; name: string; unit: string; referenceRanges: object }[] = [
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Hemoglobin',
      unit: 'g/dL',
      referenceRanges: { male: { min: 13.0, max: 17.0 }, female: { min: 12.0, max: 16.0 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'RBC Count',
      unit: 'mill/µL',
      referenceRanges: { male: { min: 4.5, max: 5.9 }, female: { min: 4.0, max: 5.2 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'WBC Count',
      unit: '10³/µL',
      referenceRanges: { general: { min: 4.0, max: 11.0 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Platelet Count',
      unit: '10³/µL',
      referenceRanges: { general: { min: 150, max: 400 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Hematocrit (PCV)',
      unit: '%',
      referenceRanges: { male: { min: 40, max: 52 }, female: { min: 36, max: 48 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'MCV',
      unit: 'fL',
      referenceRanges: { general: { min: 80, max: 100 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'MCH',
      unit: 'pg',
      referenceRanges: { general: { min: 27, max: 33 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'MCHC',
      unit: 'g/dL',
      referenceRanges: { general: { min: 31.5, max: 36.0 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Neutrophils',
      unit: '%',
      referenceRanges: { general: { min: 40, max: 75 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Lymphocytes',
      unit: '%',
      referenceRanges: { general: { min: 20, max: 45 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Monocytes',
      unit: '%',
      referenceRanges: { general: { min: 2, max: 10 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Eosinophils',
      unit: '%',
      referenceRanges: { general: { min: 1, max: 6 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'Basophils',
      unit: '%',
      referenceRanges: { general: { min: 0, max: 1 } },
    },
    {
      testId: byName('Complete Blood Count (CBC)'),
      name: 'RDW-CV',
      unit: '%',
      referenceRanges: { general: { min: 11.5, max: 14.5 } },
    },

    {
      testId: byName('ESR (Westergren Method)'),
      name: 'ESR',
      unit: 'mm/hr',
      referenceRanges: { male: { min: 0, max: 15 }, female: { min: 0, max: 20 } },
    },

    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Colour',
      unit: '',
      referenceRanges: { general: { text: 'Pale Yellow to Yellow' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Appearance',
      unit: '',
      referenceRanges: { general: { text: 'Clear' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'pH',
      unit: '',
      referenceRanges: { general: { min: 4.5, max: 8.5 } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Specific Gravity',
      unit: '',
      referenceRanges: { general: { min: 1.005, max: 1.030 } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Protein',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Glucose',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Ketones',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Blood',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Bilirubin',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Urobilinogen',
      unit: 'EU/dL',
      referenceRanges: { general: { min: 0.1, max: 1.0 } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Nitrite',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Leucocyte Esterase',
      unit: '',
      referenceRanges: { general: { text: 'Negative' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Pus Cells (WBC)',
      unit: '/HPF',
      referenceRanges: { general: { min: 0, max: 5 } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'RBC',
      unit: '/HPF',
      referenceRanges: { general: { min: 0, max: 2 } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Epithelial Cells',
      unit: '/HPF',
      referenceRanges: { general: { min: 0, max: 5 } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Casts',
      unit: '',
      referenceRanges: { general: { text: 'Nil' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Crystals',
      unit: '',
      referenceRanges: { general: { text: 'Nil' } },
    },
    {
      testId: byName('Urine Routine & Microscopy'),
      name: 'Bacteria',
      unit: '',
      referenceRanges: { general: { text: 'Nil' } },
    },

    {
      testId: byName('Peripheral Smear Examination'),
      name: 'RBC Morphology',
      unit: '',
      referenceRanges: { general: { text: 'Normocytic Normochromic' } },
    },
    {
      testId: byName('Peripheral Smear Examination'),
      name: 'WBC Morphology',
      unit: '',
      referenceRanges: { general: { text: 'Normal morphology, no blast cells' } },
    },
    {
      testId: byName('Peripheral Smear Examination'),
      name: 'Platelet Morphology',
      unit: '',
      referenceRanges: { general: { text: 'Adequate, normal morphology' } },
    },
    {
      testId: byName('Peripheral Smear Examination'),
      name: 'Impression',
      unit: '',
      referenceRanges: { general: { text: 'Normal peripheral smear' } },
    },

    {
      testId: byName('Blood Group & Rh Typing'),
      name: 'Blood Group',
      unit: '',
      referenceRanges: { general: { text: 'A / B / AB / O' } },
    },
    {
      testId: byName('Blood Group & Rh Typing'),
      name: 'Rh Factor',
      unit: '',
      referenceRanges: { general: { text: 'Positive / Negative' } },
    },

    {
      testId: byName('Blood Sugar Fasting'),
      name: 'Fasting Blood Glucose',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 70, max: 99 }, preDiabetic: { min: 100, max: 125 }, diabetic: { min: 126, max: 999 } },
    },

    {
      testId: byName('HbA1c – 3-Month Average'),
      name: 'HbA1c',
      unit: '%',
      referenceRanges: { normal: { min: 4.0, max: 5.6 }, preDiabetic: { min: 5.7, max: 6.4 }, diabetic: { min: 6.5, max: 99 } },
    },
    {
      testId: byName('HbA1c – 3-Month Average'),
      name: 'Estimated Average Glucose (eAG)',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 68, max: 126 } },
    },

    {
      testId: byName('Blood Sugar PP'),
      name: 'Post-Prandial Blood Glucose',
      unit: 'mg/dL',
      referenceRanges: { normal: { min: 70, max: 139 }, preDiabetic: { min: 140, max: 199 }, diabetic: { min: 200, max: 999 } },
    },

    {
      testId: byName('Insulin Fasting'),
      name: 'Fasting Insulin',
      unit: 'µIU/mL',
      referenceRanges: { general: { min: 2.0, max: 25.0 } },
    },
    {
      testId: byName('Insulin Fasting'),
      name: 'HOMA-IR (Insulin Resistance Index)',
      unit: '',
      referenceRanges: { general: { min: 0, max: 2.5 } },
    },

    {
      testId: byName('Thyroid Profile T3/T4/TSH'),
      name: 'T3 (Triiodothyronine)',
      unit: 'ng/dL',
      referenceRanges: { general: { min: 80, max: 200 } },
    },
    {
      testId: byName('Thyroid Profile T3/T4/TSH'),
      name: 'T4 (Thyroxine)',
      unit: 'µg/dL',
      referenceRanges: { general: { min: 5.1, max: 14.1 } },
    },
    {
      testId: byName('Thyroid Profile T3/T4/TSH'),
      name: 'TSH (Thyroid Stimulating Hormone)',
      unit: 'µIU/mL',
      referenceRanges: { general: { min: 0.27, max: 4.20 } },
    },

    {
      testId: byName('Thyroid Free FT3/FT4/TSH'),
      name: 'Free T3 (FT3)',
      unit: 'pg/mL',
      referenceRanges: { general: { min: 2.0, max: 4.4 } },
    },
    {
      testId: byName('Thyroid Free FT3/FT4/TSH'),
      name: 'Free T4 (FT4)',
      unit: 'ng/dL',
      referenceRanges: { general: { min: 0.93, max: 1.70 } },
    },
    {
      testId: byName('Thyroid Free FT3/FT4/TSH'),
      name: 'TSH',
      unit: 'µIU/mL',
      referenceRanges: { general: { min: 0.27, max: 4.20 } },
    },

    {
      testId: byName('TSH Ultra Sensitive'),
      name: 'TSH Ultra Sensitive',
      unit: 'µIU/mL',
      referenceRanges: { general: { min: 0.27, max: 4.20 } },
    },

    {
      testId: byName('Anti TPO Antibody'),
      name: 'Anti-TPO Antibody',
      unit: 'IU/mL',
      referenceRanges: { general: { min: 0, max: 34 } },
    },

    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'Total Cholesterol',
      unit: 'mg/dL',
      referenceRanges: { desirable: { min: 0, max: 199 }, borderline: { min: 200, max: 239 }, high: { min: 240, max: 999 } },
    },
    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'HDL Cholesterol',
      unit: 'mg/dL',
      referenceRanges: { male: { min: 40, max: 999 }, female: { min: 50, max: 999 } },
    },
    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'LDL Cholesterol',
      unit: 'mg/dL',
      referenceRanges: { optimal: { min: 0, max: 99 }, nearOptimal: { min: 100, max: 129 }, borderline: { min: 130, max: 159 }, high: { min: 160, max: 999 } },
    },
    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'VLDL Cholesterol',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 5, max: 40 } },
    },
    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'Triglycerides',
      unit: 'mg/dL',
      referenceRanges: { normal: { min: 0, max: 149 }, borderline: { min: 150, max: 199 }, high: { min: 200, max: 499 } },
    },
    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'Total Cholesterol / HDL Ratio (CRI)',
      unit: '',
      referenceRanges: { desirable: { min: 0, max: 4.5 } },
    },
    {
      testId: byName('Lipid Profile (7 param)'),
      name: 'LDL / HDL Ratio',
      unit: '',
      referenceRanges: { desirable: { min: 0, max: 3.5 } },
    },

    {
      testId: byName('Troponin I'),
      name: 'Troponin I',
      unit: 'ng/mL',
      referenceRanges: { general: { min: 0, max: 0.04 } },
    },

    {
      testId: byName('CRP (Cardiac Risk)'),
      name: 'hs-CRP',
      unit: 'mg/L',
      referenceRanges: { lowRisk: { min: 0, max: 1.0 }, averageRisk: { min: 1.0, max: 3.0 }, highRisk: { min: 3.0, max: 999 } },
    },

    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Total Bilirubin',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 0.2, max: 1.2 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Direct Bilirubin',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 0.0, max: 0.3 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Indirect Bilirubin',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 0.2, max: 0.9 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'SGPT (ALT)',
      unit: 'U/L',
      referenceRanges: { male: { min: 7, max: 56 }, female: { min: 7, max: 45 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'SGOT (AST)',
      unit: 'U/L',
      referenceRanges: { male: { min: 10, max: 40 }, female: { min: 10, max: 35 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Alkaline Phosphatase (ALP)',
      unit: 'U/L',
      referenceRanges: { general: { min: 44, max: 147 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Total Protein',
      unit: 'g/dL',
      referenceRanges: { general: { min: 6.4, max: 8.3 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Albumin',
      unit: 'g/dL',
      referenceRanges: { general: { min: 3.5, max: 5.0 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'Globulin',
      unit: 'g/dL',
      referenceRanges: { general: { min: 2.0, max: 3.5 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'A/G Ratio',
      unit: '',
      referenceRanges: { general: { min: 1.0, max: 2.5 } },
    },
    {
      testId: byName('Liver Function Test (LFT)'),
      name: 'GGT',
      unit: 'U/L',
      referenceRanges: { male: { min: 8, max: 61 }, female: { min: 5, max: 36 } },
    },

    {
      testId: byName('Bilirubin Total/Direct'),
      name: 'Total Bilirubin',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 0.2, max: 1.2 } },
    },
    {
      testId: byName('Bilirubin Total/Direct'),
      name: 'Direct Bilirubin',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 0.0, max: 0.3 } },
    },
    {
      testId: byName('Bilirubin Total/Direct'),
      name: 'Indirect Bilirubin',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 0.2, max: 0.9 } },
    },

    {
      testId: byName('SGPT (ALT)'),
      name: 'SGPT (ALT)',
      unit: 'U/L',
      referenceRanges: { male: { min: 7, max: 56 }, female: { min: 7, max: 45 } },
    },

    {
      testId: byName('Hepatitis B Surface Antigen'),
      name: 'HBsAg',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },

    {
      testId: byName('Vitamin D Total (25-OH)'),
      name: 'Vitamin D (25-OH)',
      unit: 'ng/mL',
      referenceRanges: { deficient: { min: 0, max: 19 }, insufficient: { min: 20, max: 29 }, sufficient: { min: 30, max: 100 }, toxic: { min: 100, max: 999 } },
    },

    {
      testId: byName('Vitamin B12 (Cobalamin)'),
      name: 'Vitamin B12',
      unit: 'pg/mL',
      referenceRanges: { deficient: { min: 0, max: 199 }, normal: { min: 200, max: 900 }, high: { min: 900, max: 9999 } },
    },

    {
      testId: byName('Iron Profile'),
      name: 'Serum Iron',
      unit: 'µg/dL',
      referenceRanges: { male: { min: 65, max: 175 }, female: { min: 50, max: 170 } },
    },
    {
      testId: byName('Iron Profile'),
      name: 'TIBC (Total Iron Binding Capacity)',
      unit: 'µg/dL',
      referenceRanges: { general: { min: 250, max: 370 } },
    },
    {
      testId: byName('Iron Profile'),
      name: 'Transferrin Saturation',
      unit: '%',
      referenceRanges: { general: { min: 20, max: 50 } },
    },
    {
      testId: byName('Iron Profile'),
      name: 'Serum Ferritin',
      unit: 'ng/mL',
      referenceRanges: { male: { min: 24, max: 336 }, female: { min: 11, max: 307 } },
    },

    {
      testId: byName('Calcium Test'),
      name: 'Serum Calcium',
      unit: 'mg/dL',
      referenceRanges: { general: { min: 8.5, max: 10.5 } },
    },

    {
      testId: byName('Dengue Duo NS1+IgG+IgM'),
      name: 'Dengue NS1 Antigen',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },
    {
      testId: byName('Dengue Duo NS1+IgG+IgM'),
      name: 'Dengue IgM Antibody',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },
    {
      testId: byName('Dengue Duo NS1+IgG+IgM'),
      name: 'Dengue IgG Antibody',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },

    {
      testId: byName('Typhoid Rapid Test'),
      name: 'Salmonella Typhi Antigen',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },

    {
      testId: byName('Malaria PF/PV Rapid'),
      name: 'P. Falciparum Antigen',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },
    {
      testId: byName('Malaria PF/PV Rapid'),
      name: 'P. Vivax Antigen',
      unit: '',
      referenceRanges: { general: { text: 'Non-Reactive' } },
    },

    {
      testId: byName('CRP Quantitative'),
      name: 'C-Reactive Protein',
      unit: 'mg/L',
      referenceRanges: { normal: { min: 0, max: 5.0 } },
    },

    {
      testId: byName('COVID-19 RT PCR'),
      name: 'SARS-CoV-2 RNA (RT-PCR)',
      unit: '',
      referenceRanges: { general: { text: 'Not Detected' } },
    },
  ];

  await prisma.testParameter.createMany({
    data: parameters,
    skipDuplicates: true,
  });

  console.log(`Test parameters seeded (${parameters.length} parameters across 29 tests)`);
}