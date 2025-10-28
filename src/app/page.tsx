'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

const API_CONFIG = {
	BASE_URL:
		process.env.NEXT_PUBLIC_8RETURNS_BASE || 'https://api.returnsportal.online',
	PASSWORD: process.env.NEXT_PUBLIC_8RETURNS_PASSWORD || '',
	API_KEY: process.env.NEXT_PUBLIC_8RETURNS_API_KEY || '',
};

function authHeader() {
	return `Bearer token="${API_CONFIG.PASSWORD}", api_key="${API_CONFIG.API_KEY}"`;
}

export default function SimpleReturnLookup() {
	const [order, setOrder] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [customerReturn, setCustomerReturn] = useState(null);
	const [items, setItems] = useState([]);
	const [busyIds, setBusyIds] = useState(new Set());
	const inputRef = useRef(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	async function lookup() {
		setError(null);
		const query = (order || '').trim();
		if (!query) {
			setError('Please enter an order number.');
			return;
		}
		setLoading(true);
		setCustomerReturn(null);
		setItems([]);

		try {
			const q = encodeURIComponent(query);
			const url = `${API_CONFIG.BASE_URL}/v1/customer_returns?s=${q}&page=1&per_page=50`;
			const resp = await fetch(url, {
				headers: { Authorization: authHeader(), Accept: 'application/json' },
			});
			if (!resp.ok) throw new Error(`Lookup failed (${resp.status})`);
			const json = await resp.json();
			const found =
				Array.isArray(json.customer_returns) && json.customer_returns.length > 0
					? json.customer_returns[0]
					: null;
			if (!found) {
				setError('No return found for that order number.');
			} else {
				setCustomerReturn(found);
				setItems(found.items || []);
			}
		} catch (err) {
			setError(err?.message || String(err));
		} finally {
			setLoading(false);
			inputRef.current?.focus();
		}
	}

	async function confirmItem(item) {
		if (!item || !item.id) return;
		const id = item.id;
		setBusyIds((prev) => new Set(prev).add(id));
		// optimistic
		const prev = items;
		setItems((curr) =>
			curr.map((it) => (it.id === id ? { ...it, is_inspected: true } : it))
		);

		try {
			const url = `${API_CONFIG.BASE_URL}/v1/items/${id}`;
			const resp = await fetch(url, {
				method: 'PUT',
				headers: {
					Authorization: authHeader(),
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify({ is_inspected: true }),
			});
			if (!resp.ok) throw new Error(`Update failed (${resp.status})`);
			const json = await resp.json().catch(() => null);
			if (json)
				setItems((curr) =>
					curr.map((it) => (it.id === id ? { ...it, ...json } : it))
				);
		} catch (err) {
			setError(err?.message || String(err));
			setItems(prev);
		} finally {
			setBusyIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
			inputRef.current?.focus();
		}
	}

	function Status({ it }) {
		const inspected = Boolean(it.is_inspected || it.inspected_date);
		const text = inspected
			? 'Inspected'
			: it.is_arrived || it.arrived_date
			? 'Arrived'
			: 'Registered';
		return (
			<Badge
				className='py-2 px-3 rounded-full text-sm'
				variant={inspected ? 'secondary' : 'outline'}>
				{text}
			</Badge>
		);
	}

	return (
		<div className='min-h-screen text-black bg-slate-50 p-4 max-w-screen-md mx-auto'>
			<header className='mb-4'>
				<h1 className='text-2xl font-semibold'>Return Lookup</h1>
				<p className='text-sm text-muted-foreground'>
					Enter order number and tap Lookup. Designed for tablet touch use.
				</p>
			</header>

			<Card className='mb-4'>
				<CardHeader>
					<CardTitle>Find return</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='flex gap-3 items-center'>
						<div className='flex-1'>
							<Label className='mb-2'>Order number</Label>
							<Input
								ref={inputRef}
								value={order}
								onChange={(e) => setOrder(e.target.value)}
								placeholder='Type order number'
								aria-label='Order number'
								className='text-lg py-3'
								onKeyDown={(e) => {
									if (e.key === 'Enter') lookup();
								}}
							/>
						</div>
						<div className='w-36'>
							<Button
								className='w-full py-3 rounded-xl'
								onClick={lookup}
								disabled={loading}>
								{loading ? 'Loading...' : 'Lookup'}
							</Button>
						</div>
					</div>
					{error && <div className='mt-3 text-sm text-red-600'>{error}</div>}
				</CardContent>
			</Card>

			{customerReturn && (
				<Card className='mb-6 text-black'>
					<CardHeader>
						<div className='flex items-center justify-between'>
							<div>
								<div className='text-lg font-medium'>
									Order {customerReturn.order_number}
								</div>
								<div className='text-xs text-muted-foreground'>
									RMA: {customerReturn.rma ?? '—'} • Items: {items.length}
								</div>
							</div>
							<div>
								<Button
									variant='ghost'
									onClick={() => {
										setCustomerReturn(null);
										setItems([]);
										setOrder('');
										inputRef.current?.focus();
									}}>
									Clear
								</Button>
							</div>
						</div>
					</CardHeader>

					<CardContent>
						<ScrollArea className='h-[55vh] md:h-[50vh]'>
							<ul className='space-y-4'>
								{items.map((it) => (
									<li
										key={it.id}
										className='bg-white rounded-2xl p-4 shadow-sm touch-none'>
										<div className='flex items-start justify-between gap-3'>
											<div className='flex-1'>
												<div className='flex items-center justify-between gap-4'>
													<div>
														<div className='text-base font-semibold'>
															{it.name || it.title || 'Item'}
														</div>
														<div className='text-sm text-muted-foreground'>
															SKU: {it.sku || '—'} • Qty: {it.quantity ?? 1}
														</div>
													</div>
													<div className='shrink-0'>
														<Status it={it} />
													</div>
												</div>
											</div>

											<div className='flex flex-col items-stretch gap-3 w-36'>
												<Button
													className='py-3 px-4 rounded-xl w-full'
													onClick={() => confirmItem(it)}
													disabled={
														busyIds.has(it.id) ||
														Boolean(it.is_inspected || it.inspected_date)
													}>
													{busyIds.has(it.id)
														? 'Saving...'
														: it.is_inspected || it.inspected_date
														? 'Inspected'
														: 'Confirm'}
												</Button>
												<Button
													variant='ghost'
													className='py-2 px-3 rounded-lg text-xs'
													onClick={() =>
														navigator.clipboard?.writeText(
															String(it.sku || it.id)
														)
													}>
													Copy SKU
												</Button>
											</div>
										</div>
									</li>
								))}

								{items.length === 0 && (
									<li className='py-6 text-center text-sm text-muted-foreground'>
										No items to display.
									</li>
								)}
							</ul>
						</ScrollArea>
					</CardContent>
				</Card>
			)}

			<footer className='text-xs text-muted-foreground mt-6'></footer>
		</div>
	);
}
