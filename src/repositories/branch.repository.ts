import { prisma } from '../lib/prisma';

export const branchRepository = {
  findAll: async (filters?: { isActive?: boolean; homeCollection?: boolean; labVisit?: boolean }) => {
    return prisma.branch.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: async (id: string) => {
    return prisma.branch.findUnique({ where: { id } });
  },

  findByCode: async (code: string) => {
    return prisma.branch.findUnique({ where: { code } });
  },

  create: async (data: {
    name: string;
    code: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    contactNumber?: string;
    email?: string;
    workingHours?: string;
    availableSlots?: any;
    homeCollection?: boolean;
    labVisit?: boolean;
    isActive?: boolean;
  }) => {
    return prisma.branch.create({ data });
  },

  update: async (id: string, data: Partial<{
    name: string;
    code: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
    contactNumber: string;
    email: string;
    workingHours: string;
    availableSlots: any;
    homeCollection: boolean;
    labVisit: boolean;
    isActive: boolean;
  }>) => {
    return prisma.branch.update({ where: { id }, data });
  },

  delete: async (id: string) => {
    return prisma.branch.delete({ where: { id } });
  },

  toggleStatus: async (id: string, isActive: boolean) => {
    return prisma.branch.update({ where: { id }, data: { isActive } });
  },
};