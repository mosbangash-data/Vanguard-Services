import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api'
export function ForbiddenPage() { return <main className="center-page"><h1>403 — Accès refusé</h1><p>Vous n’avez pas les droits nécessaires pour cet espace.</p><Link to="/">Retour</Link></main> }
export function NotFoundPage() { return <main className="center-page"><h1>Page introuvable</h1><Link to="/">Retour à l’accueil</Link></main> }
export function PublicTicketPage() { const { ticketCode } = useParams(); const { data, isPending, isError } = useQuery({ queryKey: ['public-ticket', ticketCode], queryFn: async () => (await api.get(`/tickets/${ticketCode}`)).data?.data }); return <main className="public-page"><h1>Billet</h1>{isPending ? <p>Chargement…</p> : isError ? <p>Billet introuvable.</p> : <pre>{JSON.stringify(data, null, 2)}</pre>}</main> }
