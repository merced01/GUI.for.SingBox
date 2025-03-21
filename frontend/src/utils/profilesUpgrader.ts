import { DefaultFakeIPDnsRule } from '@/constant/profile'
import { DnsServer, RuleAction, RuleType, Strategy } from '@/enums/kernel'
import { useRulesetsStore, useSubscribesStore } from '@/stores'

export const transformProfileV189To190 = (config: Recordable) => {
  const rulesetsStore = useRulesetsStore()
  const subscribesStore = useSubscribesStore()

  const local_rule_sets: IRuleSet[] = [...config.rulesConfig, ...config.dnsRulesConfig]
    .filter((rule) => rule.type === 'rule_set')
    .map((rule) => {
      const ruleset = rulesetsStore.getRulesetById(rule.payload)
      return {
        id: rule.id,
        type: 'local',
        tag: ruleset?.tag || rule.id,
        format: ruleset?.format || 'binary',
        url: ruleset?.url || '',
        download_detour: rule['download-detour'],
        update_interval: '',
        rules: '',
        path: rule.payload || '',
      }
    })

  const remote_rule_sets: IRuleSet[] = [...config.rulesConfig, ...config.dnsRulesConfig]
    .filter((rule) => rule.type === 'rule_set_url')
    .map((rule) => {
      return {
        id: rule.id,
        type: 'remote',
        tag: rule['ruleset-name'],
        format: rule['ruleset-format'],
        url: rule.payload,
        download_detour: rule['download-detour'],
        update_interval: '',
        rules: '',
        path: '',
      }
    })

  const rulesetsIdMap: Recordable = {}
  const rulesets = [...remote_rule_sets, ...local_rule_sets].reduce((p: any, c: any) => {
    const x = p.find((item: any) => item.tag === c.tag)
    if (!x) {
      rulesetsIdMap[c.id] = c.id
      return p.concat([c])
    } else {
      rulesetsIdMap[c.id] = x.id
      return p
    }
  }, [])

  const deprecatedReject = config.proxyGroupsConfig.find((v: any) =>
    ['🛑 全球拦截', '🛑 Block'].includes(v.tag),
  )

  if (deprecatedReject) {
    deprecatedReject.proxies = []
    deprecatedReject.use = []
    config.proxyGroupsConfig.forEach((group: any) => {
      group.proxies = group.proxies.filter((proxy: any) => proxy.id !== deprecatedReject.id)
    })
  }

  const deprecatedDirect = config.proxyGroupsConfig.find((v: any) =>
    ['🎯 全球直连', '🎯 Direct'].includes(v.tag),
  )

  if (deprecatedReject) {
    deprecatedDirect.proxies = []
    deprecatedDirect.use = []
    config.proxyGroupsConfig.forEach((group: any) => {
      group.proxies = group.proxies.filter((proxy: any) => proxy.id !== deprecatedDirect.id)
    })
    config.proxyGroupsConfig = config.proxyGroupsConfig.filter(
      (group: any) => group.id !== deprecatedReject.id,
    )
  }

  const profile: IProfile = {
    id: config.id,
    name: config.name,
    log: {
      disabled: false,
      level: config.generalConfig['log-level'],
      output: '',
      timestamp: false,
    },
    experimental: {
      clash_api: {
        external_controller: config.advancedConfig['external-controller'] || '127.0.0.1:20123',
        external_ui: config.advancedConfig['external-ui'] || '',
        external_ui_download_url: config.advancedConfig['external-ui-url'] || '',
        external_ui_download_detour: '',
        secret: config.advancedConfig['secret'],
        default_mode: config.generalConfig.mode,
        access_control_allow_origin: ['*'],
        access_control_allow_private_network: false,
      },
      cache_file: {
        enabled: config.advancedConfig.profile['store-cache'],
        path: 'cache.db',
        cache_id: '',
        store_fakeip: config.advancedConfig.profile['store-fake-ip'],
        store_rdrc: config.advancedConfig.profile['store-rdrc'],
        rdrc_timeout: '7d',
      },
    },
    inbounds: [
      {
        id: 'mixed-in',
        type: 'mixed',
        tag: 'mixed-in',
        enable: true,
        mixed: {
          listen: {
            listen: config.generalConfig['allow-lan'] ? '0.0.0.0' : '127.0.0.1',
            listen_port: config.generalConfig['mixed-port'] || 20122,
            tcp_fast_open: config.advancedConfig['tcp-fast-open'],
            tcp_multi_path: config.advancedConfig['tcp-multi-path'],
            udp_fragment: config.advancedConfig['udp-fragment'],
          },
          users: [],
        },
      },
      {
        id: 'tun-in',
        type: 'tun',
        tag: 'tun-in',
        enable: config.tunConfig['enable'],
        tun: {
          interface_name: config.tunConfig['interface-name'] || '',
          address: config.tunConfig['address'] || [
            config.tunConfig['inet4-address'],
            config.tunConfig['inet6-address'],
          ],
          mtu: config.tunConfig.mtu,
          auto_route: config.tunConfig['auto-route'],
          strict_route: config.tunConfig['strict-route'],
          route_address: [],
          endpoint_independent_nat: config.tunConfig['endpoint-independent-nat'],
          stack: 'mixed',
        },
      },
      {
        id: 'http-in',
        type: 'http',
        tag: 'http-in',
        enable: config.advancedConfig.port !== 0,
        http: {
          listen: {
            listen: config.generalConfig['allow-lan'] ? '0.0.0.0' : '127.0.0.1',
            listen_port: config.advancedConfig['port'] || 20121,
            tcp_fast_open: config.advancedConfig['tcp-fast-open'],
            tcp_multi_path: config.advancedConfig['tcp-multi-path'],
            udp_fragment: config.advancedConfig['udp-fragment'],
          },
          users: [],
        },
      },
      {
        id: 'socks-in',
        type: 'socks',
        tag: 'socks-in',
        enable: config.advancedConfig['socks-port'] !== 0,
        socks: {
          listen: {
            listen: config.generalConfig['allow-lan'] ? '0.0.0.0' : '127.0.0.1',
            listen_port: config.advancedConfig['socks-port'] || 20120,
            tcp_fast_open: config.advancedConfig['tcp-fast-open'],
            tcp_multi_path: config.advancedConfig['tcp-multi-path'],
            udp_fragment: config.advancedConfig['udp-fragment'],
          },
          users: [],
        },
      },
    ],
    outbounds: config.proxyGroupsConfig.flatMap((group: any) => {
      if (!['selector', 'urltest'].includes(group.type)) return []
      let type = group.type
      if (['🎯 全球直连', '🎯 Direct'].includes(group.tag)) {
        type = 'direct'
      }
      return {
        id: group.id,
        tag: group.tag,
        type,
        outbounds: [
          ...group.proxies.flatMap((proxy: any) => {
            if (['block', 'direct'].includes(proxy.tag)) return []
            return {
              id: proxy.type === 'built-in' ? proxy.id : proxy.type,
              tag: proxy.tag,
              type: proxy.type === 'built-in' ? 'Built-in' : 'Subscription',
            }
          }),
          ...group.use.flatMap((use: any) => {
            const sub = subscribesStore.getSubscribeById(use)
            if (!sub) return []
            return {
              id: sub.id,
              tag: sub.name,
              type: 'Subscription',
            }
          }),
        ],
        interrupt_exist_connections: true,
        url: group.url,
        interval: '3m',
        tolerance: group.tolerance,
        include: group.filter,
        exclude: '',
      }
    }),
    // @ts-expect-error(Deprecated)
    route: {
      rule_set: rulesets,
      rules: config.rulesConfig.flatMap((rule: any) => {
        if (rule.type === 'final') return []
        const extra: Recordable = {}
        if (rule.type === 'rule_set_url' || rule.type === 'rule_set') {
          extra.type = 'rule_set'
          extra.payload = rulesetsIdMap[rule.id]
        }
        return {
          id: rule.id,
          type: rule.type,
          payload: rule.payload,
          invert: rule.invert,
          action:
            rule.proxy === 'block'
              ? RuleAction.Reject
              : rule.proxy === 'dns-out'
                ? RuleAction.HijackDNS
                : rule.proxy === deprecatedReject?.id
                  ? RuleAction.Reject
                  : RuleAction.Route,
          outbound: ['dns-out', deprecatedReject?.id].includes(rule.proxy)
            ? ''
            : rule.proxy === 'direct'
              ? deprecatedDirect?.id
              : rule.proxy,
          sniffer: [],
          strategy: Strategy.Default,
          server: '',
          ...extra,
        }
      }),
      auto_detect_interface: true,
      find_process: false,
      default_interface: config.generalConfig['interface-name'],
      final: config.rulesConfig.find((v: any) => v.type === 'final')?.proxy || '',
    },
    dns: {
      servers: [
        {
          id: 'remote-dns',
          tag: 'remote-dns',
          // @ts-expect-error(Deprecated)
          address: config.dnsConfig['remote-dns'],
          address_resolver: 'remote-resolver-dns',
          detour: config.dnsConfig['remote-dns-detour'],
          strategy: Strategy.Default,
          client_subnet: '',
        },
        {
          id: 'local-dns',
          tag: 'local-dns',
          // @ts-expect-error(Deprecated)
          address: config.dnsConfig['local-dns'],
          address_resolver: 'resolver-dns',
          detour: config.dnsConfig['local-dns-detour'],
          strategy: Strategy.Default,
          client_subnet: '',
        },
        {
          id: 'resolver-dns',
          tag: 'resolver-dns',
          // @ts-expect-error(Deprecated)
          address: config.dnsConfig['resolver-dns'],
          address_resolver: '',
          detour: config.dnsConfig['local-dns-detour'],
          strategy: Strategy.Default,
          client_subnet: '',
        },
        {
          id: 'remote-resolver-dns',
          tag: 'remote-resolver-dns',
          // @ts-expect-error(Deprecated)
          address: config.dnsConfig['remote-resolver-dns'],
          address_resolver: '',
          detour: '',
          strategy: Strategy.Default,
          client_subnet: '',
        },
        {
          id: 'fakeip',
          tag: 'fakeip-dns',
          // @ts-expect-error(Deprecated)
          address: 'fakeip',
          address_resolver: '',
          detour: '',
          strategy: Strategy.Default,
          client_subnet: '',
        },
      ],
      rules: config.dnsRulesConfig.map((rule: any, index: number) => {
        const extra: Recordable = {}
        if (rule.type === 'rule_set_url' || rule.type === 'rule_set') {
          extra.type = 'rule_set'
          extra.payload = rulesetsIdMap[rule.id]
        } else if (rule.type === 'fakeip') {
          extra.type = RuleType.Inline
          const fakeip = DefaultFakeIPDnsRule()
          fakeip.rules[0].domain_suffix = config.dnsConfig['fake-ip-filter']
          extra.payload = JSON.stringify(fakeip, null, 2)
          extra.server = 'fakeip'
        } else {
          extra.payload = rule.payload
        }
        return {
          id: index,
          type: rule.type,
          action: rule.server === 'block' ? RuleAction.Reject : RuleAction.Route,
          server: rule.server === 'block' ? '' : rule.server,
          invert: rule.invert,
          ...extra,
        }
      }),
      fakeip: {
        enabled: config.dnsConfig['fakeip'],
        inet4_range: config.dnsConfig['fake-ip-range-v4'],
        inet6_range: config.dnsConfig['fake-ip-range-v6'],
      },
      disable_cache: config.dnsConfig['disable-cache'],
      disable_expire: config.dnsConfig['disable-expire'],
      independent_cache: config.dnsConfig['independent-cache'],
      client_subnet: config.dnsConfig['client-subnet'],
      final: config.dnsConfig['final-dns'],
      strategy: config.dnsConfig['strategy'],
    },
    mixin: config.mixinConfig,
    script: config.scriptConfig,
  }

  return profile
}

export const transformProfileV194 = (config: Recordable) => {
  const outboundServer = config.dns.rules.find((rule: Recordable) => rule.type === 'outbound')

  config.route.default_domain_resolver = {
    server: outboundServer?.server || '',
    client_subnet: '',
  }

  config.dns.servers = config.dns.servers.flatMap((server: Recordable) => {
    const _server: IDNSServer = {
      id: server.id,
      tag: server.tag,
      type: DnsServer.Local,
      detour: server.detour,
      domain_resolver: server.address_resolver,
      hosts_path: [],
      predefined: {},
      server: server.address,
      server_port: '',
      path: '',
      interface: '',
      inet4_range: '',
      inet6_range: '',
    }
    if (server.address === 'local') {
      server.type = DnsServer.Local
    } else if (server.address.startsWith('tcp://')) {
      const url = new URL(server.address)
      _server.type = DnsServer.Tcp
      _server.server = url.hostname
      _server.server_port = url.port
    } else if (server.address.startsWith('tls://')) {
      const url = new URL(server.address)
      _server.type = DnsServer.Tls
      _server.server = url.hostname
      _server.server_port = url.port
    } else if (server.address.startsWith('quic://')) {
      const url = new URL(server.address)
      server.type = DnsServer.Quic
      _server.server = url.hostname
      _server.server_port = url.port
    } else if (server.address.startsWith('https://')) {
      const url = new URL(server.address)
      _server.type = DnsServer.Https
      _server.server = url.hostname
      _server.server_port = url.port
      _server.path = url.pathname
    } else if (server.address.startsWith('h3://')) {
      const url = new URL(server.address)
      _server.type = DnsServer.H3
      _server.server = url.hostname
      _server.server_port = url.port
      _server.path = url.pathname
    } else if (server.address.startsWith('dhcp://')) {
      const url = new URL(server.address)
      _server.type = DnsServer.Dhcp
      _server.interface = url.hostname
    } else if (server.address === 'fakeip') {
      _server.type = DnsServer.FakeIP
      _server.inet4_range = config.dns.fakeip.inet4_range
      _server.inet6_range = config.dns.fakeip.inet6_range
    } else if (server.address.startsWith('rcode://')) {
      return [] // skip
    } else {
      _server.type = DnsServer.Udp
    }
    return _server
  })

  config.dns.rules = config.dns.rules.flatMap((rule: Recordable) => {
    if (rule.type === 'outbound') return []
    const _rule: IDNSRule = {
      id: rule.id,
      type: rule.type,
      payload: rule.payload,
      action: rule.action,
      invert: rule.invert,
      server: rule.server,
      strategy: Strategy.Default,
      disable_cache: false,
      client_subnet: '',
    }
    return _rule
  })

  delete config.dns.fakeip

  return config as IProfile
}
