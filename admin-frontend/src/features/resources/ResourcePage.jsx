import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { hasPermission } from '../auth/permissions'
import { useAuth } from '../auth/authContext'
import { createResource, deleteResource, listResource, patchResource, updateResource } from './resourceApi'

const errorMessage = (error) => error?.response?.data?.message || 'L’opération a échoué. Vérifiez les données saisies.'
const toList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return Object.values(data || {}).find(Array.isArray) || []
}
const getId = (item) => item.id || item._id || item.code || item.ticketCode

function JsonForm({ initial, onSubmit, submitLabel, onCancel }) {
  const [value, setValue] = useState(JSON.stringify(initial || {}, null, 2)); const [error, setError] = useState('')
  const submit = (event) => { event.preventDefault(); try { onSubmit(JSON.parse(value)); } catch { setError('Le contenu doit être un JSON valide.') } }
  return <form className="json-form" onSubmit={submit}><label>Données JSON correspondant au contrat backend<textarea value={value} onChange={(e) => setValue(e.target.value)} rows="12" /></label>{error && <p className="error">{error}</p>}<div><button className="button" type="submit">{submitLabel}</button>{onCancel && <button className="button secondary" type="button" onClick={onCancel}>Annuler</button>}</div></form>
}

export function ResourcePage({ resource }) {
  const { user } = useAuth(); const client = useQueryClient(); const [search, setSearch] = useState(''); const [form, setForm] = useState(null); const [notice, setNotice] = useState('')
  const enabled = !resource.unavailable && (!resource.permission || hasPermission(user, resource.permission) || user?.role === 'SUPER_ADMIN')
  const query = useQuery({ queryKey: ['resource', resource.endpoint, search], queryFn: () => listResource(resource.endpoint, search ? { search, page: 1, limit: 50 } : { page: 1, limit: 50 }), enabled })
  const refresh = () => client.invalidateQueries({ queryKey: ['resource', resource.endpoint] })
  const mutation = useMutation({ mutationFn: async ({ action, id, data }) => action === 'create' ? createResource(resource.endpoint, data) : action === 'update' ? updateResource(resource.endpoint, id, data) : action === 'status' ? patchResource(resource.endpoint, id, '/status', data) : action === 'reset' ? patchResource(resource.endpoint, id, '/password-reset', data) : deleteResource(resource.endpoint, id), onSuccess: () => { setForm(null); setNotice('Opération effectuée.'); refresh() } })
  const items = useMemo(() => toList(query.data), [query.data]); const can = (permission) => !permission ? !resource.readOnly : hasPermission(user, permission) || user?.role === 'SUPER_ADMIN'
  if (resource.unavailable) return <section className="page"><h1>{resource.label}</h1><p className="empty">{resource.unavailable}</p></section>
  if (!enabled) return <section className="page"><h1>{resource.label}</h1><p className="empty">Cette fonctionnalité requiert une permission non accordée.</p></section>
  return <section className="page"><div className="page-head"><div><h1>{resource.label}</h1><p>Les données affichées proviennent de l’API.</p></div>{can(resource.createPermission) && <button className="button" onClick={() => setForm({ action: 'create', initial: {} })}>Créer</button>}</div><div className="toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" /><button className="button secondary" onClick={() => query.refetch()}>Actualiser</button></div>{notice && <p className="success">{notice}</p>}{mutation.isError && <p className="error">{errorMessage(mutation.error)}</p>}{form && <JsonForm initial={form.initial} submitLabel={form.action === 'create' ? 'Créer' : 'Enregistrer'} onCancel={() => setForm(null)} onSubmit={(data) => mutation.mutate({ action: form.action, id: form.id, data })} />}{query.isPending ? <p>Chargement…</p> : query.isError ? <p className="error">Impossible de charger les données.</p> : items.length === 0 ? <p className="empty">Aucune donnée disponible.</p> : <div className="table-wrap"><table><thead><tr>{Object.keys(items[0]).slice(0, 7).map((key) => <th key={key}>{key}</th>)}<th>Actions</th></tr></thead><tbody>{items.map((item, index) => { const id = getId(item); return <tr key={id || index}>{Object.keys(items[0]).slice(0, 7).map((key) => <td key={key}>{typeof item[key] === 'object' ? JSON.stringify(item[key]) : String(item[key] ?? '')}</td>)}<td className="actions">{id && can(resource.updatePermission) && <button onClick={() => setForm({ action: 'update', id, initial: item })}>Modifier</button>}{id && resource.status && <button onClick={() => setForm({ action: 'status', id, initial: { status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } })}>Statut</button>}{id && resource.passwordReset && <button onClick={() => setForm({ action: 'reset', id, initial: { newPassword: '' } })}>Mot de passe</button>}{id && can(resource.deletePermission) && <button className="danger" onClick={() => window.confirm('Supprimer cet élément ?') && mutation.mutate({ action: 'delete', id })}>Supprimer</button>}</td></tr>})}</tbody></table></div>}</section>
}
