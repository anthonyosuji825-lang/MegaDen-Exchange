'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import Link from 'next/link'
import LoadingScreen from '@/components/LoadingScreen'

const services = [
  { id: 'whatsapp',   name: 'WhatsApp',    color: '#25d366' },
  { id: 'telegram',   name: 'Telegram',    color: '#0088cc' },
  { id: 'facebook',   name: 'Facebook',    color: '#1877f2' },
  { id: 'instagram',  name: 'Instagram',   color: '#e1306c' },
  { id: 'tiktok',     name: 'TikTok',      color: '#ff0050' },
  { id: 'gmail',      name: 'Gmail',       color: '#ea4335' },
  { id: 'twitter',    name: 'Twitter / X', color: '#e7e7e7' },
  { id: 'google',     name: 'Google',      color: '#4285f4' },
  { id: 'discord',    name: 'Discord',     color: '#5865f2' },
  { id: 'snapchat',   name: 'Snapchat',    color: '#fffc00' },
  { id: 'linkedin',   name: 'LinkedIn',    color: '#0a66c2' },
  { id: 'amazon',     name: 'Amazon',      color: '#ff9900' },
  { id: 'microsoft',  name: 'Microsoft',   color: '#00a4ef' },
  { id: 'viber',      name: 'Viber',       color: '#7360f2' },
  { id: 'line',       name: 'Line',        color: '#06c755' },
  { id: 'signal',     name: 'Signal',      color: '#3a76f0' },
  { id: 'uber',       name: 'Uber',        color: '#000000' },
  { id: 'netflix',    name: 'Netflix',     color: '#e50914' },
  { id: 'tinder',     name: 'Tinder',      color: '#fd5564' },
  { id: 'paypal',     name: 'PayPal',      color: '#003087' },
  { id: 'wechat',     name: 'WeChat',      color: '#07c160' },
  { id: 'yahoo',      name: 'Yahoo',       color: '#6001d2' },
  { id: 'steam',      name: 'Steam',       color: '#1b2838' },
  { id: 'shopee',     name: 'Shopee',      color: '#f53d2d' },
  { id: 'truecaller', name: 'Truecaller',  color: '#009de0' },
  { id: 'zoho',       name: 'Zoho',        color: '#c8202d' },
  { id: 'proton',     name: 'ProtonMail',  color: '#6d4aff' },
  { id: 'any',        name: 'Any SMS',     color: '#6c4ef2' },
]

const ServiceIcon = ({ id, size = 26 }) => {
  const icons = {
    whatsapp: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#25d366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    telegram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#0088cc">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    facebook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877f2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <linearGradient id="ig2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f09433"/>
            <stop offset="25%" stopColor="#e6683c"/>
            <stop offset="50%" stopColor="#dc2743"/>
            <stop offset="75%" stopColor="#cc2366"/>
            <stop offset="100%" stopColor="#bc1888"/>
          </linearGradient>
        </defs>
        <path fill="url(#ig2)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    tiktok: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#ff0050" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/>
      </svg>
    ),
    gmail: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#ea4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.148C21.69 2.28 24 3.434 24 5.457z"/>
      </svg>
    ),
    twitter: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#e7e7e7">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    any: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#6c4ef2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    google: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    discord: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865f2">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    snapchat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#fffc00">
        <path d="M12.166.006C9.834-.072 7.2.637 5.51 2.341 4.073 3.786 3.42 5.836 3.34 7.835c-.05 1.215-.01 2.43-.01 3.644-.31.156-.636.23-.968.252-.347.024-.706-.027-1.02-.177-.186-.09-.4-.232-.604-.166-.21.068-.332.292-.334.506-.003.29.212.527.46.645.82.387 1.693.4 2.566.553.1.463.275.902.572 1.28.07.09.004.226-.073.295-.28.247-.595.44-.904.637-.424.269-.87.568-1.117 1.017-.145.264-.146.6.044.843.208.266.553.326.863.3.468-.04.91-.225 1.355-.375.333-.113.688-.228 1.04-.188.32.036.598.205.856.39.567.406 1.103.876 1.793 1.117.747.26 1.54.295 2.326.3h.194c.786-.005 1.58-.04 2.327-.3.69-.241 1.226-.711 1.793-1.117.258-.185.535-.354.855-.39.353-.04.708.075 1.041.188.445.15.887.334 1.355.375.31.026.655-.034.863-.3.19-.243.189-.579.044-.843-.247-.449-.693-.748-1.117-1.017-.31-.197-.624-.39-.904-.637-.077-.069-.144-.206-.073-.295.297-.378.471-.817.572-1.28.873-.153 1.746-.166 2.566-.553.248-.118.463-.355.46-.645-.002-.214-.123-.438-.334-.506-.204-.066-.418.076-.604.166-.314.15-.673.2-1.02.177-.332-.022-.658-.096-.968-.252 0-1.215.04-2.43-.01-3.644-.08-1.999-.733-4.05-2.17-5.494C16.8.637 14.165-.072 12.166.006"/>
      </svg>
    ),
    linkedin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#0a66c2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    amazon: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#ff9900" d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.076-1.047-.872-1.234-1.276-1.814-2.106-1.733 1.767-2.959 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.095v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.331c-.259-.058-.548-.266-.472-.66C5.57 2.7 8.983 1.624 12.06 1.624c1.568 0 3.614.418 4.848 1.605 1.568 1.469 1.418 3.428 1.418 5.558v5.031c0 1.513.627 2.177 1.217 2.994.207.291.252.639-.01.855-.661.55-1.836 1.57-2.479 2.142l-.01-.014zm3.648 1.83C18.902 21.703 16.132 23 13.337 23c-3.81 0-6.93-1.418-9.414-3.783-.197-.178-.021-.422.215-.283 2.679 1.558 5.985 2.494 9.405 2.494 2.308 0 4.843-.479 7.174-1.471.351-.151.647.23.275.558zm.95-2.705c-.267-.343-1.77-.162-2.447-.082-.205.025-.237-.154-.051-.283 1.197-.842 3.162-.599 3.39-.317.228.283-.06 2.248-1.185 3.186-.172.145-.337.068-.26-.123.253-.631.817-2.041.553-2.381z"/>
      </svg>
    ),
    microsoft: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#f25022" d="M1 1h10v10H1z"/>
        <path fill="#00a4ef" d="M13 1h10v10H13z"/>
        <path fill="#7fba00" d="M1 13h10v10H1z"/>
        <path fill="#ffb900" d="M13 13h10v10H13z"/>
      </svg>
    ),
    viber: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#7360f2">
        <path d="M11.4.006C9.396.022 4.98.285 2.548 2.535 .804 4.28.21 6.83.144 9.988c-.066 3.158-.132 9.08 5.567 10.702h.005l-.005 2.456s-.038.96.596 1.152c.77.232 1.215-.492 1.95-1.28.4-.438.955-1.06 1.376-1.558 3.793.32 6.71-.41 7.043-.518.766-.248 5.1-.803 5.8-6.545.72-5.916-.35-9.649-2.834-11.329l-.001-.001c-.712-.506-3.57-1.066-7.24-1.06h-.001zm.034 1.76c3.16-.003 5.756.454 6.29.826 2.03 1.39 2.89 4.643 2.268 9.73-.578 4.847-4.022 5.15-4.666 5.356-.276.09-2.892.73-6.168.528 0 0-2.44 2.95-3.2 3.717-.118.12-.256.168-.348.147-.128-.03-.163-.18-.162-.394l.022-3.607C2.98 16.4 1.77 12.042 1.83 9.93c.057-2.63.53-4.82 1.98-6.224C5.856 1.9 9.746 1.768 11.434 1.765zM12 5.09c-1.69 0-3.1.68-4.21 2.04l.012-.017c-.99 1.24-1.49 2.73-1.49 4.47 0 1.51.37 2.83 1.11 3.97l.03.04-1.35 1.34c-.15.15-.18.38-.07.55.11.17.33.25.52.19l1.64-.68c1.04.85 2.31 1.37 3.81 1.37 1.69 0 3.1-.68 4.21-2.04.99-1.24 1.49-2.73 1.49-4.46s-.5-3.22-1.49-4.46c-1.1-1.36-2.52-2.31-4.22-2.31zm-.07 1.37c1.32 0 2.41.52 3.28 1.57.77.95 1.15 2.1 1.15 3.44 0 1.34-.38 2.49-1.15 3.44-.87 1.05-1.96 1.57-3.28 1.57-1.1 0-2.04-.35-2.83-1.04l-.25-.23-1.13.47.39-1.07-.2-.28c-.67-.9-1.01-1.95-1.01-3.15 0-1.34.38-2.49 1.15-3.44.86-1.05 1.96-1.57 3.08-1.78zm.06.88c-.45 0-.85.16-1.2.47-.35.31-.52.71-.52 1.2 0 .35.09.66.27.93.18.27.44.49.79.65l.29.12-.06.28c-.04.2-.12.37-.24.51.39-.05.73-.24 1.01-.56.28-.32.44-.69.49-1.11-.02-.53-.19-.97-.5-1.32-.31-.35-.69-.17-1.33-.17zm-1.77 4.1c.15.27.36.49.61.66l-.5.21.41-.52c-.19-.1-.36-.21-.52-.35zm-.12-.4c.04.16.1.31.17.44l-.56.24.39-.68zm3.84-1.65c-.04.53-.19.99-.46 1.39l.04.01c-.27.4-.64.72-1.1.95-.46.23-.95.35-1.47.35-.15 0-.3-.01-.45-.03.27-.11.5-.28.68-.5l.01-.01c.24-.28.38-.62.41-.99.5-.02.93-.18 1.28-.48.35-.3.55-.67.62-1.11.13-.03.27-.04.44-.04v.47z"/>
      </svg>
    ),
    line: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#06c755">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
      </svg>
    ),
    signal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#3a76f0">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a8 8 0 110 16A8 8 0 0112 4zm0 2a6 6 0 100 12A6 6 0 0012 6zm0 2a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z"/>
      </svg>
    ),
    uber: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#000"/>
        <path fill="#fff" d="M5 7h2v6a2 2 0 004 0V7h2v6a4 4 0 01-8 0V7zm9 0h2v10h-2V7z"/>
      </svg>
    ),
    netflix: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#e50914">
        <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.578.788.15 1.555.343 2.scalc.429l-1.732-4.882c.918.196 1.87.309 2.854.309 4.785 0 8.664-3.879 8.664-8.664S22.451 2.13 17.666 2.13c-1.97 0-3.786.654-5.252 1.745C11.194 1.486 9.048 0 6.524 0H5.398zm8.28 4.805c1.01-.72 2.237-1.148 3.566-1.148 3.387 0 6.137 2.75 6.137 6.136s-2.75 6.137-6.137 6.137c-.706 0-1.385-.12-2.017-.34L13.678 4.805zM5.398 2.54v18.92c.65.14 1.295.298 1.94.465V12.37l5.97 9.555c.655.187 1.31.38 1.96.582L9.29 12.42V2.54H5.398z"/>
      </svg>
    ),
    tinder: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#fd5564">
        <path d="M8.21 10.08c-.02 0-.04 0-.06-.02-.67-.9-.84-1.96-.85-2.72 0-.34-.38-.54-.65-.34C4.6 8.4 3 10.87 3 13.55 3 18.74 7.26 23 12.45 23c5.2 0 9.45-4.26 9.45-9.45 0-5.39-3.87-9.17-7.77-10.03-.39-.09-.75.23-.7.62.23 2.07-.45 4.05-1.83 5.67-.19.23-.04.42.61.27z"/>
      </svg>
    ),
    paypal: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#003087" d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 4.643-5.813 4.643h-2.19c-.524 0-.968.382-1.05.9l-1.42 9.007h3.544c.524 0 .968-.383 1.05-.9l.586-3.704c.082-.518.527-.9 1.05-.9h1.364c3.688 0 6.074-1.715 6.85-5.12.31-1.375.196-2.546-.323-3.64z"/>
      </svg>
    ),
    wechat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#07c160">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-5.972 3.067-7.965C11.24 3.027 9.94 2.188 8.691 2.188zm-2.48 3.69c.498 0 .9.402.9.9 0 .498-.402.9-.9.9a.9.9 0 110-1.8zm4.95 0c.498 0 .9.402.9.9 0 .498-.402.9-.9.9a.9.9 0 110-1.8zM24 14.601c0-3.399-3.247-6.16-7.25-6.16s-7.25 2.761-7.25 6.16c0 3.4 3.247 6.16 7.25 6.16.957 0 1.874-.14 2.722-.395a.717.717 0 01.594.082l1.54.9a.297.297 0 00.14.047c.134 0 .24-.107.24-.242 0-.06-.024-.12-.04-.177l-.316-1.2a.49.49 0 01.178-.554C23.04 18.447 24 16.617 24 14.6zm-9.75-1.27a.75.75 0 110-1.5.75.75 0 010 1.5zm5 0a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
      </svg>
    ),
    yahoo: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#6001d2">
        <path d="M0 0l6.693 15.93L0 24h3.434l3.615-5.784L10.663 24h3.434L7.405 7.898h8.533L24 0H0z"/>
      </svg>
    ),
    steam: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#1b2838">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.979-5.355 11.979-11.979 0-6.623-5.355-11.979-11.979-11.979zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.503 1.009 2.459-.4.957-1.502 1.41-2.458 1.008zM16.53 7.975c0-1.658-1.349-3.007-3.005-3.007-1.661 0-3.01 1.349-3.01 3.007 0 1.661 1.349 3.01 3.01 3.01 1.656 0 3.005-1.349 3.005-3.01zm-5.258-.005c0-1.252 1.013-2.266 2.265-2.266 1.251 0 2.265 1.014 2.265 2.266 0 1.251-1.014 2.265-2.265 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
      </svg>
    ),
    shopee: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#f53d2d">
        <path d="M19.317 5.43C18.59 2.374 15.836 0 12.525 0c-3.312 0-6.065 2.374-6.792 5.43H3.5L2 24h21L21.5 5.43h-2.183zM12.525 1.694c2.516 0 4.626 1.773 5.187 4.144H7.338c.561-2.371 2.672-4.144 5.187-4.144zm5.547 13.938a5.547 5.547 0 01-5.547 5.547 5.547 5.547 0 01-5.547-5.547 5.547 5.547 0 015.547-5.547 5.547 5.547 0 015.547 5.547zm-5.547-3.853a3.853 3.853 0 100 7.706 3.853 3.853 0 000-7.706z"/>
      </svg>
    ),
    truecaller: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#009de0">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.25 16.5l-1.5 1.5L9 11.25V7.5h2.25v3l6 6z"/>
      </svg>
    ),
    zoho: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#c8202d">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
    ),
    proton: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#6d4aff">
        <path d="M24 0H0v24h13.5c5.799 0 10.5-4.701 10.5-10.5V0zM13.5 17H11V9h2.5c2.21 0 4 1.79 4 4s-1.79 4-4 4z"/>
      </svg>
    ),
  }
  return icons[id] || null
}

export default function BuyNumbers() {
  const [search, setSearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [countries, setCountries] = useState([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [purchased, setPurchased] = useState(null)
  const [sms, setSms] = useState([])
  const [countdown, setCountdown] = useState(0)
  const [copied, setCopied] = useState(false)
  const [servicePage, setServicePage] = useState(0)
  const pollTimerRef = useRef(null)
  const cdTimerRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      setPageLoading(false)
    }
    load()
  }, [])

  const fetchCountries = async (serviceId) => {
    setLoadingCountries(true)
    setCountries([])
    setSelectedCountry(null)
    setError('')
    try {
      const res = await fetch(`/api/5sim/countries?service=${serviceId}`)
      const data = await res.json()
      setCountries(data.countries || [])
    } catch {
      setError('Failed to load countries. Please refresh.')
    }
    setLoadingCountries(false)
  }

  const handleServiceSelect = (service) => {
    setSelectedService(service)
    setSelectedCountry(null)
    fetchCountries(service.id)
  }

  // Countdown + SMS polling after purchase
  useEffect(() => {
    if (!purchased) return
    setCountdown(purchased.expires_in)

    cdTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(cdTimerRef.current)
          clearInterval(pollTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/5sim/sms?id=${purchased.fivesim_id}&order_id=${purchased.order_id}`)
        const data = await res.json()
        if (data.sms && data.sms.length > 0) {
          setSms(data.sms)
          clearInterval(pollTimerRef.current)
          clearInterval(cdTimerRef.current)
        }
        if (data.status === 'FINISHED' || data.status === 'BANNED' || data.status === 'TIMEOUT') {
          clearInterval(pollTimerRef.current)
          clearInterval(cdTimerRef.current)
        }
      } catch (e) {
        console.error('SMS poll error:', e)
      }
    }, 5000)

    return () => {
      clearInterval(cdTimerRef.current)
      clearInterval(pollTimerRef.current)
    }
  }, [purchased])

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  // ✅ FIX: No longer sends userId or priceNgn from client
  const handleOrder = async () => {
    if (!selectedCountry || !selectedService || !user) return
    setOrdering(true)
    setError('')
    const res = await fetch('/api/5sim/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: selectedCountry.code,
        service: selectedService.id,
        price_ngn: selectedCountry.price_ngn,
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Purchase failed. Try again.')
      setOrdering(false)
      return
    }
    // ✅ Use server-returned price_ngn, not client-side price
    setProfile(p => ({ ...p, wallet_balance: (p.wallet_balance || 0) - data.price_ngn }))
    setPurchased({
      phone: data.phone,
      fivesim_id: data.fivesim_id,
      order_id: data.order_id,
      expires_in: data.expires_in,
      price_ngn: data.price_ngn,
      country: selectedCountry,
      service: selectedService,
    })
    setOrdering(false)
  }

  // ✅ FIX: Sends JSON body (not query params) + handles errors properly
  const handleCancel = async () => {
    if (!purchased) return
    try {
      const res = await fetch('/api/5sim/sms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fivesimId: purchased.fivesim_id,
          orderId: purchased.order_id,
          userId: user.id,
          amount: purchased.price_ngn,
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Cancel failed. Contact support.')
        return
      }
      setProfile(p => ({ ...p, wallet_balance: (p.wallet_balance || 0) + purchased.price_ngn }))
    } catch (err) {
      setError('Cancel failed. Contact support.')
      return
    }
    setPurchased(null)
    setSms([])
    setSelectedCountry(null)
    setSelectedService(null)
    setCountries([])
  }

  const copyPhone = () => {
    if (!purchased?.phone) return
    navigator.clipboard.writeText(purchased.phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const hasBalance = (profile?.wallet_balance || 0) >= (selectedCountry?.price_ngn || 0)

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '5rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes smsReveal {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 12px rgba(108,78,242,0.3); }
          50%       { box-shadow: 0 0 28px rgba(108,78,242,0.6); }
        }
        @keyframes bounceX {
          0%, 100% { transform: translateX(0); opacity: 0.5; }
          50%       { transform: translateX(4px); opacity: 1; }
        }

        * { box-sizing: border-box; }

        .service-grid::-webkit-scrollbar { display: none; }

        .service-chip {
          transition: transform 0.15s ease, border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .service-chip:hover { transform: translateY(-2px); }
        .service-chip:active { transform: scale(0.97); }

        .country-card {
          transition: transform 0.15s ease, border-color 0.15s, background 0.15s;
        }
        .country-card:hover { transform: translateY(-1px); }
        .country-card:active { transform: scale(0.98); }

        .buy-btn {
          transition: transform 0.18s ease, box-shadow 0.18s, background 0.18s;
        }
        .buy-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 32px rgba(108,78,242,0.45);
        }
        .buy-btn:active:not(:disabled) { transform: scale(0.98); }

        .back-btn {
          transition: background 0.15s, transform 0.15s;
        }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }

        .copy-btn {
          transition: background 0.15s, transform 0.15s;
        }
        .copy-btn:hover { transform: scale(1.05); }
        .copy-btn:active { transform: scale(0.95); }

        .cancel-btn {
          transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
        }
        .cancel-btn:hover {
          background: rgba(244,63,94,0.08) !important;
          border-color: rgba(244,63,94,0.4) !important;
          color: #f43f5e !important;
          transform: translateY(-1px);
        }

        .search-input:focus {
          border-color: var(--purple) !important;
          box-shadow: 0 0 0 3px rgba(108,78,242,0.12);
        }

        .progress-ring {
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }

        .number-display {
          background: linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(192,120,26,0.06) 100%);
          border: 1px solid rgba(108,78,242,0.25);
          animation: glow 3s ease infinite;
        }

        @media (max-width: 380px) {
          .country-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── STICKY HEADER ── */}
      <div style={{
        padding: '1rem 1.2rem',
        display: 'flex', alignItems: 'center', gap: '0.85rem',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <Link href="/dashboard" className="back-btn" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '10px',
          background: 'var(--card)', border: '1px solid var(--border)',
          color: 'var(--text)', textDecoration: 'none', flexShrink: 0,
        }}>
          <BackIcon />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Virtual Numbers
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>
            Instant delivery · 20-min window
          </div>
        </div>

        {/* Wallet pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.35rem 0.75rem',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '20px', flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>
            ₦{(profile?.wallet_balance || 0).toLocaleString()}
          </span>
        </div>
      </div>

      <div style={{ padding: '1.2rem', maxWidth: 480, margin: '0 auto' }}>

        {/* ── PURCHASED: ACTIVE NUMBER VIEW ── */}
        {purchased ? (
          <div style={{ animation: 'scaleIn 0.35s ease both' }}>

            {/* Active number card */}
            <div className="number-display" style={{
              borderRadius: '20px', padding: '1.5rem',
              marginBottom: '1rem', position: 'relative', overflow: 'hidden',
            }}>
              {/* Service badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: purchased.service.color,
                    boxShadow: `0 0 10px ${purchased.service.color}`,
                    animation: sms.length === 0 ? 'pulse 2s ease infinite' : 'none',
                  }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                    {purchased.service.name} · {purchased.country.flag} {purchased.country.name}
                  </span>
                </div>

                {/* Countdown */}
                {sms.length === 0 && countdown > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={countdown < 120 ? '#f43f5e' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span style={{
                      fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem',
                      color: countdown < 120 ? '#f43f5e' : 'var(--muted)',
                    }}>
                      {formatCountdown(countdown)}
                    </span>
                  </div>
                )}
                {sms.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>
                    <CheckIcon size={12} color="#34d399" /> Received
                  </div>
                )}
              </div>

              {/* Phone number */}
              <div style={{ marginBottom: '1.2rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Your Number
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <span style={{
                    fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem',
                    color: 'var(--text)', letterSpacing: '0.02em', flex: 1,
                  }}>
                    {purchased.phone}
                  </span>
                  <button onClick={copyPhone} className="copy-btn" style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.85rem',
                    background: copied ? 'rgba(52,211,153,0.12)' : 'var(--card)',
                    border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
                    borderRadius: '10px', cursor: 'pointer',
                    color: copied ? '#34d399' : 'var(--text)', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {copied ? <><CheckIcon size={12} color="#34d399" /> Copied</> : <><CopyIcon /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {sms.length === 0 && (
                <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: countdown < 120 ? '#f43f5e' : 'var(--purple)',
                    width: `${(countdown / (purchased.expires_in || 1200)) * 100}%`,
                    transition: 'width 1s linear, background 0.5s',
                  }} />
                </div>
              )}
            </div>

            {/* SMS received */}
            {sms.length > 0 ? (
              <div style={{
                background: 'rgba(52,211,153,0.07)',
                border: '1px solid rgba(52,211,153,0.25)',
                borderRadius: '16px', padding: '1.2rem',
                marginBottom: '1rem', animation: 'smsReveal 0.4s ease both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    SMS Received
                  </span>
                </div>
                {sms.map((s, i) => (
                  <div key={i}>
                    {s.code && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Verification Code
                        </div>
                        <div style={{
                          fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '2rem',
                          color: 'var(--text)', letterSpacing: '0.15em',
                        }}>
                          {s.code}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{s.text}</div>
                  </div>
                ))}
              </div>
            ) : countdown === 0 ? (
              <div style={{
                background: 'rgba(244,63,94,0.07)',
                border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: '14px', padding: '1rem',
                marginBottom: '1rem', textAlign: 'center',
                fontSize: '0.82rem', color: '#f43f5e',
              }}>
                ⏱ Time expired — no SMS received.
              </div>
            ) : (
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '1rem',
                marginBottom: '1rem', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Waiting for SMS…</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                  Send a verification code to {purchased.phone}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.7rem' }}>
              {sms.length === 0 && countdown > 0 && (
                <button onClick={handleCancel} className="cancel-btn" style={{
                  flex: 1, padding: '0.85rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '12px', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                }}>
                  Cancel & Refund
                </button>
              )}
              <button onClick={() => {
                setPurchased(null); setSms([])
                setSelectedCountry(null); setSelectedService(null); setCountries([])
              }} className="buy-btn" style={{
                flex: 1, padding: '0.85rem',
                background: 'var(--purple)', color: '#fff', border: 'none',
                borderRadius: '12px', cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700,
              }}>
                Buy Another
              </button>
            </div>

            {error && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '10px', fontSize: '0.78rem', color: '#f43f5e' }}>
                {error}
              </div>
            )}
          </div>

        ) : (
          <>
            {/* ── STEP 1: SERVICE SELECTION ── */}
            <div style={{ marginBottom: '1.5rem', animation: mounted ? 'fadeSlideIn 0.35s ease 0.05s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
                <StepBadge n={1} done={!!selectedService} />
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                  Select Service
                </span>
                {selectedService && (
                  <span style={{ fontSize: '0.72rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckIcon size={11} color="#34d399" />
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: selectedService.color }} />
                    {selectedService.name}
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <div
                  className="service-grid"
                  ref={el => { if (el) { el.onscroll = () => { const page = Math.round(el.scrollLeft / el.clientWidth); setServicePage(page) } } }}
                  style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gridAutoFlow: 'column', gridAutoColumns: 'calc(25% - 0.38rem)', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.3rem', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {services.map((s, i) => {
                    const isSelected = selectedService?.id === s.id
                    return (
                      <button key={s.id} className="service-chip"
                        onClick={() => handleServiceSelect(s)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: '0.5rem', padding: '1rem 0.4rem',
                          background: isSelected ? `${s.color}15` : 'var(--card)',
                          border: `1.5px solid ${isSelected ? s.color : 'var(--border)'}`,
                          borderRadius: '14px', cursor: 'pointer',
                          boxShadow: isSelected ? `0 4px 16px ${s.color}33` : 'none',
                          animation: mounted ? `fadeSlideIn 0.3s ease ${0.04 * i}s both` : 'none',
                        }}>
                        <div style={{ filter: isSelected ? 'none' : 'grayscale(20%) opacity(0.85)', transition: 'filter 0.2s' }}>
                          <ServiceIcon id={s.id} size={26} />
                        </div>
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 600,
                          color: isSelected ? s.color : 'var(--muted)',
                          textAlign: 'center', lineHeight: 1.2,
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis', width: '100%',
                        }}>
                          {s.name.replace(' / X', '')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Dot indicators + swipe hint */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
                {/* Dots — 28 services, 8 per page = 4 pages */}
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{
                      width: servicePage === i ? 16 : 6,
                      height: 6, borderRadius: 99,
                      background: servicePage === i ? 'var(--purple)' : 'var(--border)',
                      transition: 'all 0.3s ease',
                    }} />
                  ))}
                </div>
                {/* Swipe text */}
                <span style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  Swipe to see more services →
                </span>
              </div>
            </div>

            {/* ── STEP 2: COUNTRY SELECTION ── */}
            {selectedService && (
              <div style={{ marginBottom: '1.5rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
                  <StepBadge n={2} done={!!selectedCountry} />
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                    Select Country
                  </span>
                  {selectedCountry && (
                    <span style={{ fontSize: '0.72rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckIcon size={11} color="#34d399" />
                      {selectedCountry.flag} {selectedCountry.name}
                    </span>
                  )}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
                    <SearchIcon size={14} />
                  </div>
                  <input
                    className="search-input"
                    placeholder="Search country…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '0.7rem 1rem 0.7rem 2.4rem',
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: '12px', color: 'var(--text)', fontSize: '0.85rem',
                      outline: 'none', fontFamily: 'Inter, sans-serif',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }} />
                </div>

                {loadingCountries ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '2.5rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Loading countries…
                  </div>
                ) : (
                  <div className="country-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxHeight: 340, overflowY: 'auto', paddingRight: 2 }}>
                    {filtered.map((c, i) => {
                      const isSelected = selectedCountry?.code === c.code
                      return (
                        <button key={c.code} className="country-card"
                          onClick={() => setSelectedCountry(c)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            padding: '0.7rem 0.8rem',
                            background: isSelected ? 'rgba(108,78,242,0.1)' : 'var(--card)',
                            border: `1.5px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`,
                            borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                            animation: mounted ? `fadeSlideIn 0.3s ease ${Math.min(i * 0.025, 0.25)}s both` : 'none',
                          }}>
                          <span style={{ fontSize: '1.3rem', lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '0.67rem', color: 'var(--gold)', fontWeight: 700, marginTop: '0.1rem' }}>
                              ₦{c.price_ngn?.toLocaleString()}
                            </div>
                          </div>
                          {isSelected && (
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 }} />
                          )}
                        </button>
                      )
                    })}
                    {filtered.length === 0 && !loadingCountries && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                        No countries found for "{search}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ORDER SUMMARY + BUY ── */}
            {selectedCountry && selectedService && (
              <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                {/* Summary card */}
                <div style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '16px', padding: '1rem', marginBottom: '0.75rem',
                }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.75rem' }}>
                    Order Summary
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <SummaryRow label="Service">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ServiceIcon id={selectedService.id} size={14} />
                        {selectedService.name}
                      </span>
                    </SummaryRow>
                    <SummaryRow label="Country">
                      {selectedCountry.flag} {selectedCountry.name}
                    </SummaryRow>
                    <SummaryRow label="Balance">
                      <span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                        ₦{(profile?.wallet_balance || 0).toLocaleString()}
                      </span>
                    </SummaryRow>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.1rem 0' }} />
                    <SummaryRow label="Total" bold>
                      <span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
                        ₦{selectedCountry.price_ngn?.toLocaleString()}
                      </span>
                    </SummaryRow>
                  </div>
                </div>

                {/* Insufficient balance warning */}
                {!hasBalance && (
                  <div style={{
                    background: 'rgba(244,63,94,0.07)',
                    border: '1px solid rgba(244,63,94,0.2)',
                    borderRadius: '12px', padding: '0.75rem 1rem',
                    fontSize: '0.8rem', color: '#f43f5e',
                    marginBottom: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span>Insufficient balance</span>
                    <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>
                      Fund Wallet →
                    </Link>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
                    borderRadius: '12px', padding: '0.75rem 1rem',
                    fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem',
                  }}>
                    {error}
                  </div>
                )}

                {/* Buy button */}
                <button
                  onClick={handleOrder}
                  disabled={ordering || !hasBalance}
                  className="buy-btn"
                  style={{
                    width: '100%', padding: '1rem',
                    background: !hasBalance ? 'var(--card2)' : ordering ? 'var(--purple2)' : 'var(--purple)',
                    color: !hasBalance ? 'var(--muted)' : '#fff',
                    border: 'none', borderRadius: '14px',
                    fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700,
                    cursor: ordering || !hasBalance ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                    opacity: !hasBalance ? 0.6 : 1,
                  }}>
                  {ordering ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Getting your number…
                    </>
                  ) : (
                    `Buy Number — ₦${selectedCountry.price_ngn?.toLocaleString()}`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

// ── Small reusable components ──

function StepBadge({ n, done }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: done ? '#34d399' : 'var(--purple)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'background 0.3s',
    }}>
      {done
        ? <CheckIcon size={11} color="#fff" />
        : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>
      }
    </div>
  )
}

function SummaryRow({ label, children, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '0.5rem' }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function BackIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function SearchIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function CheckIcon({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function CopyIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}