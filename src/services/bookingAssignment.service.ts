import { prisma } from '../lib/prisma';
import {
  DEFAULT_BOOKING_RADIUS_KM,
  hasValidCoordinates,
  isWithinServiceRadius,
} from '../utils/geo.utils';
import { sendNotificationToMultipleUsers } from './notification.service';

export interface BookingLocation {
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
}

export async function getBookingLocation(addressId: string | null | undefined): Promise<BookingLocation> {
  if (!addressId) {
    return { latitude: null, longitude: null, pincode: null };
  }

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) {
    return { latitude: null, longitude: null, pincode: null };
  }

  return {
    latitude: address.latitude,
    longitude: address.longitude,
    pincode: address.pincode,
  };
}

export function isBookingWithinCollectorRadius(
  booking: BookingLocation,
  collectorLat: number | null | undefined,
  collectorLon: number | null | undefined,
  radiusKm = DEFAULT_BOOKING_RADIUS_KM
): boolean {
  if (!hasValidCoordinates(booking.latitude, booking.longitude)) {
    return true; // Allow bookings without GPS (e.g. manual doctor bookings) to be broadcasted
  }
  return isWithinServiceRadius(
    booking.latitude,
    booking.longitude,
    collectorLat,
    collectorLon,
    radiusKm,
    false
  );
}

export async function findEligiblePartnerUserIds(
  booking: BookingLocation,
  excludePartnerIds: string[] = []
): Promise<string[]> {
  const partners = await prisma.pathologyPartner.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isAvailable: true,
      ...(excludePartnerIds.length ? { id: { notIn: excludePartnerIds } } : {}),
    },
    include: { user: { select: { id: true } } },
  });

  return partners
    .filter((partner) =>
      isBookingWithinCollectorRadius(
        booking,
        partner.latitude,
        partner.longitude,
        partner.serviceRadiusKm ?? DEFAULT_BOOKING_RADIUS_KM
      )
    )
    .map((partner) => partner.user.id);
}

export async function findEligiblePhlebotomistUserIds(booking: BookingLocation): Promise<string[]> {
  const staff = await prisma.adminUser.findMany({
    where: {
      isActive: true,
      userType: { in: ['STAFF', 'FREELANCER'] },
      user: { role: 'EXECUTIVE' },
    },
    include: { user: { select: { id: true } } },
  });

  return staff
    .filter((member) =>
      isBookingWithinCollectorRadius(booking, member.latitude, member.longitude, DEFAULT_BOOKING_RADIUS_KM)
    )
    .map((member) => member.user.id);
}

export async function notifyNearbyCollectorsForBooking(
  bookingId: string,
  patientLabel?: string
): Promise<number> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: { select: { name: true } } },
  });

  if (!booking || booking.collectionMode !== 'HOME') return 0;

  const location = await getBookingLocation(booking.addressId);
  const partnerUserIds = await findEligiblePartnerUserIds(location);
  const phlebotomistUserIds = await findEligiblePhlebotomistUserIds(location);
  const recipientIds = [...new Set([...partnerUserIds, ...phlebotomistUserIds])];

  if (recipientIds.length === 0) return 0;

  const label = patientLabel || booking.user?.name || 'A patient';
  await sendNotificationToMultipleUsers(
    recipientIds,
    'New Booking Assigned',
    `${label} has placed a new home collection booking within your service radius.`,
    'NEW_BOOKING_ASSIGNED',
    { bookingId }
  );

  return recipientIds.length;
}

export async function getCollectorContext(userId: string): Promise<{
  partnerId: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  isApproved: boolean;
  isAvailable: boolean;
}> {
  const partner = await prisma.pathologyPartner.findUnique({
    where: { userId },
  });

  const adminUser = await prisma.adminUser.findFirst({
    where: { userId, isActive: true },
    include: { branch: true, user: { select: { role: true } } },
  });

  // Priority 1: Collector's own live / saved GPS coordinates
  let lat: number | null = partner?.latitude ?? adminUser?.latitude ?? null;
  let lon: number | null = partner?.longitude ?? adminUser?.longitude ?? null;

  // Priority 2 (Secondary Fallback): If collector has no GPS coordinates yet, inherit from parent branch/lab
  if (!hasValidCoordinates(lat, lon)) {
    const branch = adminUser?.branch;
    if (branch && hasValidCoordinates(branch.latitude, branch.longitude)) {
      lat = branch.latitude;
      lon = branch.longitude;
    } else {
      const targetBranchId = partner?.branchId || adminUser?.branchId;
      const targetPartnerId = adminUser?.partnerId;
      if (targetPartnerId) {
        const parentPartner = await prisma.pathologyPartner.findUnique({ where: { id: targetPartnerId } });
        if (parentPartner && hasValidCoordinates(parentPartner.latitude, parentPartner.longitude)) {
          lat = parentPartner.latitude;
          lon = parentPartner.longitude;
        }
      }
      if (!hasValidCoordinates(lat, lon) && targetBranchId) {
        const parentLab = await prisma.pathologyPartner.findFirst({
          where: { branchId: targetBranchId, role: 'LAB_PARTNER' },
        });
        if (parentLab && hasValidCoordinates(parentLab.latitude, parentLab.longitude)) {
          lat = parentLab.latitude;
          lon = parentLab.longitude;
        }
      }
    }
  }

  if (partner) {
    return {
      partnerId: partner.id,
      latitude: lat,
      longitude: lon,
      radiusKm: partner.serviceRadiusKm ?? DEFAULT_BOOKING_RADIUS_KM,
      isApproved: partner.approvalStatus === 'APPROVED',
      isAvailable: partner.isAvailable,
    };
  }

  if (adminUser && adminUser.user.role === 'EXECUTIVE') {
    return {
      partnerId: null,
      latitude: lat,
      longitude: lon,
      radiusKm: DEFAULT_BOOKING_RADIUS_KM,
      isApproved: true,
      isAvailable: true,
    };
  }

  return {
    partnerId: null,
    latitude: lat,
    longitude: lon,
    radiusKm: DEFAULT_BOOKING_RADIUS_KM,
    isApproved: false,
    isAvailable: false,
  };
}
