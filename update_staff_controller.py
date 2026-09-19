import sys

file_path = "src/controllers/staffController.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# getStaff changes
old_getstaff_where = """    if (!isSuperAdmin && userBranchId) {
      where.branchId = userBranchId;
    } else if (branchId) {
      where.branchId = String(branchId);
    }"""
new_getstaff_where = """    const userPartnerId = req.user?.partnerId;

    if (!isSuperAdmin && userBranchId) {
      where.branchId = userBranchId;
    } else if (!isSuperAdmin && userPartnerId) {
      where.partnerId = userPartnerId;
    } else if (branchId) {
      where.branchId = String(branchId);
    }"""
content = content.replace(old_getstaff_where, new_getstaff_where)

old_getstaff_return = """    res.json(staffList);
  } catch (error: any) {"""
new_getstaff_return = """    const partnerIds = staffList.map((s: any) => s.partnerId).filter(Boolean);
    if (partnerIds.length > 0) {
      const partners = await prisma.pathologyPartner.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, labName: true, city: true }
      });
      const partnerMap = new Map(partners.map(p => [p.id, p]));
      staffList.forEach((s: any) => {
        if (s.partnerId) {
          s.pathologyPartner = partnerMap.get(s.partnerId);
        }
      });
    }

    res.json(staffList);
  } catch (error: any) {"""
content = content.replace(old_getstaff_return, new_getstaff_return)

# createStaff changes
old_create_args = """      designation,
      branchId,
      franchiseId,"""
new_create_args = """      designation,
      branchId,
      partnerId,
      franchiseId,"""
content = content.replace(old_create_args, new_create_args)

old_create_resolve = """    // Auto-resolve branch
    const isSuperAdmin = req.user?.isSuperAdmin || (req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';
    const targetBranchId = branchId || (!isSuperAdmin ? req.user?.branchId : null) || null;"""
new_create_resolve = """    // Auto-resolve branch
    const isSuperAdmin = req.user?.isSuperAdmin || (req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';
    const targetBranchId = branchId || (!isSuperAdmin ? req.user?.branchId : null) || null;
    const targetPartnerId = partnerId || (!isSuperAdmin ? req.user?.partnerId : null) || null;"""
content = content.replace(old_create_resolve, new_create_resolve)

old_create_data = """        designation: designation || (isPhlebo ? 'Phlebotomist / Sample Collector' : 'Lab Technician'),
        branchId: targetBranchId,
        userType: isPhlebo ? 'STAFF' : (userType || 'EMPLOYEE'),"""
new_create_data = """        designation: designation || (isPhlebo ? 'Phlebotomist / Sample Collector' : 'Lab Technician'),
        branchId: targetBranchId,
        partnerId: targetPartnerId,
        userType: isPhlebo ? 'STAFF' : (userType || 'EMPLOYEE'),"""
content = content.replace(old_create_data, new_create_data)

# updateStaff changes
old_update_args = """      designation,
      branchId,
      franchiseId,"""
new_update_args = """      designation,
      branchId,
      partnerId,
      franchiseId,"""
content = content.replace(old_update_args, new_update_args)

old_update_data = """    if (branchId !== undefined) staffData.branchId = branchId || null;
    if (franchiseId !== undefined) staffData.franchiseId = franchiseId || null;"""
new_update_data = """    if (branchId !== undefined) staffData.branchId = branchId || null;
    if (partnerId !== undefined) staffData.partnerId = partnerId || null;
    if (franchiseId !== undefined) staffData.franchiseId = franchiseId || null;"""
content = content.replace(old_update_data, new_update_data)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated staffController.ts")
