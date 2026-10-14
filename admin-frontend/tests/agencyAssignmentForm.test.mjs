import test from 'node:test'
import assert from 'node:assert/strict'
import { translations } from '../src/i18n/translations.js'
import {
  buildAgencyAwareUserPayload,
  getAgencyAssignmentForSelection,
  reconcileRoleSelection,
} from '../src/features/admin/users/agencyAssignmentForm.js'

const departments = [
  { id: 'coach-id', type: 'VANGUARD_COACH' },
  { id: 'auto-id', type: 'AUTO_SALES' },
]
const roles = [
  { id: 'coach-agent', name: 'AGENT', departmentTypes: ['VANGUARD_COACH', 'AUTO_SALES'], agencyAssignmentPolicies: { VANGUARD_COACH: { allowed: true, required: true }, AUTO_SALES: { allowed: false, required: false } } },
  { id: 'manager', name: 'MANAGER', departmentTypes: ['VANGUARD_COACH'], agencyAssignmentPolicies: { VANGUARD_COACH: { allowed: true, required: true } } },
  { id: 'super', name: 'SUPER_ADMIN', departmentTypes: ['VANGUARD_COACH'], agencyAssignmentPolicies: { VANGUARD_COACH: { allowed: false, required: false } } },
]

test('creation and editing use the server policy and discard hidden agency values', () => {
  const agentPolicy = getAgencyAssignmentForSelection(roles, departments, 'coach-agent', 'coach-id')
  const superAdminPolicy = getAgencyAssignmentForSelection(roles, departments, 'super', 'coach-id')
  const autoAgentPolicy = getAgencyAssignmentForSelection(roles, departments, 'coach-agent', 'auto-id')
  assert.equal(agentPolicy.required, true)
  assert.equal(autoAgentPolicy.required, false)
  assert.equal(superAdminPolicy.required, false)
  assert.deepEqual(buildAgencyAwareUserPayload({ roleId: 'super', departmentId: 'coach-id', agencyId: 'stale' }, superAdminPolicy), { roleId: 'super', departmentId: 'coach-id' })
  assert.equal(buildAgencyAwareUserPayload({ roleId: 'manager', departmentId: 'coach-id', agencyId: 'agency-a' }, agentPolicy).agencyId, 'agency-a')
  assert.equal(buildAgencyAwareUserPayload({ roleId: 'super', departmentId: 'coach-id', agencyId: 'stale' }, superAdminPolicy, { clearDisallowed: true }).agencyId, null)
})

test('changing the selected role clears an old agency and incompatible department', () => {
  const next = reconcileRoleSelection({ roleId: 'manager', departmentId: 'coach-id', agencyId: 'agency-a' }, 'super', roles, departments)
  assert.equal(next.agencyId, '')
  const switched = reconcileRoleSelection({ roleId: 'manager', departmentId: 'coach-id', agencyId: 'agency-a' }, 'coach-agent', roles, departments)
  assert.equal(switched.agencyId, '')
  assert.equal(switched.departmentId, 'coach-id')
})

test('agency validation messages are available in French and English', () => {
  assert.match(translations.fr.userAdmin.agencyRequired, /agence active/i)
  assert.match(translations.en.userAdmin.agencyRequired, /active .* agency/i)
  assert.notEqual(translations.fr.userAdmin.agencyRequired, translations.en.userAdmin.agencyRequired)
})
