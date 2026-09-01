import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import cloudinary from '../config/cloudinary';



const logCmsAction = async (
  adminId: string | undefined,
  adminRole: string | undefined,
  action: string,
  resource: string,
  resourceId?: string,
  details?: object
) => {
  await prisma.cmsAuditLog.create({
    data: { adminId, adminRole, action, resource, resourceId, details },
  });
};

export const getBanners = async (req: AuthRequest, res: Response) => {
  try {
    const banners = await prisma.cmsBanner.findMany({ orderBy: { displayOrder: 'asc' } });
    res.json({ banners });
  } catch {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

export const createBanner = async (req: AuthRequest, res: Response) => {
  try {
    const { title, subtitle, description, imageUrl, imagePublicId, linkType, linkValue, priority, displayOrder, startDate, endDate, cities, branches } = req.body;
    if (!title || !imageUrl) return res.status(400).json({ error: 'title and imageUrl are required' });
    const banner = await prisma.cmsBanner.create({
      data: {
        title, subtitle, description, imageUrl, imagePublicId,
        linkType: linkType || 'Package', linkValue,
        priority: priority || 0,
        displayOrder: displayOrder || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        cities: cities || [],
        branches: branches || [],
        isActive: true,
        createdById: req.user?.id,
      },
    });
    await logCmsAction(req.user?.id, req.user?.role, 'BANNER_CREATED', 'CmsBanner', banner.id, { title });
    res.status(201).json({ banner });
  } catch {
    res.status(500).json({ error: 'Failed to create banner' });
  }
};

export const updateBanner = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const banner = await prisma.cmsBanner.update({ where: { id }, data });
    await logCmsAction(req.user?.id, req.user?.role, 'BANNER_UPDATED', 'CmsBanner', id);
    res.json({ banner });
  } catch {
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

export const deleteBanner = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const banner = await prisma.cmsBanner.findUnique({ where: { id } });
    if (!banner) return res.status(404).json({ error: 'Banner not found' });
    if (banner.imagePublicId) {
      await cloudinary.uploader.destroy(banner.imagePublicId).catch(() => {});
    }
    await prisma.cmsBanner.delete({ where: { id } });
    await logCmsAction(req.user?.id, req.user?.role, 'BANNER_DELETED', 'CmsBanner', id, { title: banner.title });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};

export const uploadBannerImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'cms/banners' });
    res.json({ imageUrl: result.secure_url, publicId: result.public_id });
  } catch {
    res.status(500).json({ error: 'Image upload failed' });
  }
};

const getOrCreateConfig = async () => {
  let config = await prisma.cmsConfig.findUnique({ where: { id: 'singleton' } });
  if (!config) {
    config = await prisma.cmsConfig.create({
      data: {
        id: 'singleton',
        layoutSections: ['hero_banner', 'quick_categories', 'trending_packages', 'ai_health_tips'],
        categoryOrder: ['Blood', 'Diabetes', 'Thyroid', 'Cardiac', 'Womens Health', 'Liver', 'Kidney'],
        featureFlags: {
          enableOnlineConsultations: false,
          enableAiSymptomsChat: true,
          enableReportsWallet: true,
          enableUrgentCollection: false,
          enableHomeCollection: true,
          enablePrescriptionUpload: true,
          enableReferralProgram: false,
          enableHealthTracker: false,
          enableNotifications: true,
          enableAppointments: false,
        },
        maintenance: {
          globalMaintenance: false,
          disableBookings: false,
          disablePayments: false,
          disableHomeCollection: false,
          disableReports: false,
          maintenanceMessage: '',
          maintenanceStart: null,
          maintenanceEnd: null,
        },
        minVersion: {
          minAndroid: '1.0.0',
          minIOS: '1.0.0',
          forceUpdate: false,
          updateMessage: 'Please update the app to continue.',
        },
        contactInfo: {
          supportPhone: '',
          whatsapp: '',
          email: '',
          address: '',
          workingHours: '',
          emergencyContact: '',
        },
        socialLinks: {
          instagram: '',
          facebook: '',
          twitter: '',
          linkedin: '',
          youtube: '',
          website: '',
        },
      },
    });
  }
  return config;
};

export const getConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await getOrCreateConfig();
    res.json({ config });
  } catch {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
};

export const updateConfig = async (req: AuthRequest, res: Response) => {
  try {
    const allowedKeys = ['layoutSections', 'categoryOrder', 'featureFlags', 'maintenance', 'minVersion', 'contactInfo', 'socialLinks'];
    const data: any = { updatedById: req.user?.id };
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    await getOrCreateConfig();
    const config = await prisma.cmsConfig.update({ where: { id: 'singleton' }, data });
    await logCmsAction(req.user?.id, req.user?.role, 'CONFIG_UPDATED', 'CmsConfig', 'singleton', { keys: Object.keys(data) });
    res.json({ config });
  } catch {
    res.status(500).json({ error: 'Failed to update config' });
  }
};

export const getAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const alerts = await prisma.cmsEmergencyAlert.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ alerts });
  } catch {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

export const upsertAlert = async (req: AuthRequest, res: Response) => {
  try {
    const { id, title, message, severity, startTime, endTime, cities, branches, isActive } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
    let alert;
    if (id) {
      alert = await prisma.cmsEmergencyAlert.update({
        where: { id },
        data: {
          title, message, severity: severity || 'info',
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : null,
          cities: cities || [], branches: branches || [], isActive,
        },
      });
      await logCmsAction(req.user?.id, req.user?.role, 'ALERT_UPDATED', 'CmsEmergencyAlert', id);
    } else {
      alert = await prisma.cmsEmergencyAlert.create({
        data: {
          title, message, severity: severity || 'info',
          startTime: startTime ? new Date(startTime) : new Date(),
          endTime: endTime ? new Date(endTime) : null,
          cities: cities || [], branches: branches || [],
          isActive: isActive !== undefined ? isActive : true,
          createdById: req.user?.id,
        },
      });
      await logCmsAction(req.user?.id, req.user?.role, 'ALERT_CREATED', 'CmsEmergencyAlert', alert.id);
    }
    res.json({ alert });
  } catch {
    res.status(500).json({ error: 'Failed to save alert' });
  }
};

export const deleteAlert = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.cmsEmergencyAlert.delete({ where: { id } });
    await logCmsAction(req.user?.id, req.user?.role, 'ALERT_DELETED', 'CmsEmergencyAlert', id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete alert' });
  }
};

export const getPages = async (req: AuthRequest, res: Response) => {
  try {
    const pages = await prisma.cmsPage.findMany({ orderBy: { slug: 'asc' } });
    if (pages.length === 0) {
      const defaults = [
        { id: 'privacy', slug: 'privacy-policy', title: 'Privacy Policy', content: '' },
        { id: 'terms', slug: 'terms-conditions', title: 'Terms & Conditions', content: '' },
        { id: 'refund', slug: 'refund-policy', title: 'Refund Policy', content: '' },
        { id: 'cancellation', slug: 'cancellation-policy', title: 'Cancellation Policy', content: '' },
        { id: 'about', slug: 'about-us', title: 'About Us', content: '' },
        { id: 'contact', slug: 'contact-us', title: 'Contact Us', content: '' },
        { id: 'faq', slug: 'faqs', title: 'FAQs', content: '' },
      ];
      await prisma.cmsPage.createMany({ data: defaults, skipDuplicates: true });
      return res.json({ pages: defaults });
    }
    res.json({ pages });
  } catch {
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
};

export const updatePage = async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { content, title } = req.body;
    const page = await prisma.cmsPage.update({
      where: { slug },
      data: { content, title, updatedById: req.user?.id },
    });
    await logCmsAction(req.user?.id, req.user?.role, 'PAGE_UPDATED', 'CmsPage', slug, { title });
    res.json({ page });
  } catch {
    res.status(500).json({ error: 'Failed to update page' });
  }
};

export const getCmsAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.cmsAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ logs });
  } catch {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};