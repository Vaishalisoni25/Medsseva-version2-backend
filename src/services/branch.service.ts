import { branchRepository } from '../repositories/branch.repository';

export const branchService = {
  getAllBranches: async (query: {
    isActive?: string;
    homeCollection?: string;
    labVisit?: string;
    lat?: string;
    lng?: string;
  }) => {
    const filters: any = {};
    if (query.isActive !== undefined) filters.isActive = query.isActive === 'true';
    if (query.homeCollection === 'true') filters.homeCollection = true;
    if (query.labVisit === 'true') filters.labVisit = true;
    
    let branches = await branchRepository.findAll(filters);

    if (query.lat && query.lng) {
      const lat1 = parseFloat(query.lat);
      const lon1 = parseFloat(query.lng);

      const toRad = (value: number) => (value * Math.PI) / 180;
      
      const calcDistance = (lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      branches = branches.map((b: any) => {
        if (b.latitude && b.longitude) {
          return { ...b, distance: calcDistance(b.latitude, b.longitude) };
        }
        return { ...b, distance: 999999 }; // put branches without coordinates at the end
      }).sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
    }

    return branches;
  },

getBranchById: async (id: string) => {
    const branch = await branchRepository.findById(id);
    if (!branch) throw new Error('Branch not found');

    const rawSlots: string[] = Array.isArray(branch.availableSlots) ? branch.availableSlots as string[] : [];

    const normalizeSlot = (slot: string): string => {
      if (slot.includes(' - ')) return slot;
      const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return slot;
      let hour = parseInt(match[1], 10);
      const minute = match[2];
      const meridiem = match[3].toUpperCase();
      const startLabel = `${String(hour).padStart(2, '0')}:${minute} ${meridiem}`;
      let nextHour = hour + 1;
      let nextMeridiem = meridiem;
      if (hour === 11 && meridiem === 'AM') { nextHour = 12; nextMeridiem = 'PM'; }
      else if (hour === 12 && meridiem === 'PM') { nextHour = 1; nextMeridiem = 'PM'; }
      else if (nextHour === 12) { nextMeridiem = meridiem === 'AM' ? 'PM' : 'AM'; }
      else if (nextHour > 12) { nextHour = nextHour - 12; }
      const endLabel = `${String(nextHour).padStart(2, '0')}:${minute} ${nextMeridiem}`;
      return `${startLabel} - ${endLabel}`;
    };

    return {
      ...branch,
      availableSlots: rawSlots.map(normalizeSlot),
    };
  },

  createBranch: async (data: any) => {
    const existing = await branchRepository.findByCode(data.code);
    if (existing) throw new Error('Branch code already exists');
    return branchRepository.create(data);
  },

  updateBranch: async (id: string, data: any) => {
    await branchService.getBranchById(id);
    if (data.code) {
      const existing = await branchRepository.findByCode(data.code);
      if (existing && existing.id !== id) throw new Error('Branch code already in use');
    }
    return branchRepository.update(id, data);
  },

  deleteBranch: async (id: string) => {
    await branchService.getBranchById(id);
    return branchRepository.delete(id);
  },

  toggleStatus: async (id: string, isActive: boolean) => {
    await branchService.getBranchById(id);
    return branchRepository.toggleStatus(id, isActive);
  },
};