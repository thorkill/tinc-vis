#!/usr/bin/env python2

import argparse
import json
import sys
import socket
import time

from pkg_resources import parse_version

import tinctools

if parse_version(tinctools.__version__) >= parse_version('0.3') and \
    parse_version(tinctools.__version__) < parse_version('0.4'):
    from tinctools import connection, parse
    from tinctools.connection import Request
else:
    raise ImportWarning, "tinctools version: {} not supported".format(tinctools.__version__)

class TincVis:

    def __init__(self, net, rundir):
        self.net = net
        self.nodes = {}
        self.edges = {}
        self.tincctl = connection.Control(net, rundir=rundir, reconn=True)
        self.tincinfo = parse.TincInfo()
        self.n2id = {}
        self.id2n = {}

        self.minWeight = sys.maxint
        self.maxWeight = 1


    def __computeHash(self, source, target):
        if (int(source['id']) <= int(target['id'])):
            return "{}-{}".format(source['id'],
                                  target['id'])
        else:
            return "{}-{}".format(target['id'],
                                  source['id'])

    def __parseAll(self):
        connData = self.tincctl.communicate(Request.DUMP_CONNECTIONS)
        subnetData = self.tincctl.communicate(Request.DUMP_SUBNETS)
        nodeData = self.tincctl.communicate(Request.DUMP_NODES)
        edgeData = self.tincctl.communicate(Request.DUMP_EDGES)
        self.tincinfo.parse_connections(data=connData)
        self.tincinfo.parse_networks(data=subnetData)
        self.tincinfo.parse_nodes(data=nodeData)
        self.tincinfo.parse_edges(data=edgeData)

    def prepare(self):
        self.__parseAll()
        uniqueEdges = set()

        try:
            del(self.tincinfo.nodes['(broadcast)'])
        except:
            pass

        cnt = 0
        for n in self.tincinfo.nodes:
            node = self.nodes.setdefault(n, {'id': None,
                                             'networks': self.tincinfo.nodes[n].network,
                                             'edges': 0,
                                             'version': 0,
                                             'name': n})
            node['edges'] = 0
            if not node['id']:
                node['id'] = cnt+1
                cnt += 1

        for ed in self.tincinfo.edges:

            try:
                _hash = self.__computeHash(self.nodes[ed['from']], self.nodes[ed['to']])
            except KeyError:
                print('warning: empty edge found - ignoring...')
                continue

            if _hash not in uniqueEdges:
                e = self.edges.setdefault(ed['from'], [])
                e.append({'source': self.nodes[ed['from']]['id'],
                          'target' : self.nodes[ed['to']]['id'],
                          '_hash': _hash,
                          'weight': ed['weight']})
                self.nodes[ed['from']]['edges'] += 1
                self.nodes[ed['to']]['edges'] += 1

                uniqueEdges.add(_hash)

            self.nodes[ed['to']]['version'] = ed['options']>>24

            if self.minWeight > int(ed['weight']):
                self.minWeight = int(ed['weight'])

            if self.maxWeight < int(ed['weight']):
                self.maxWeight = int(ed['weight'])

    def getFracWeight(self, cur):
        return round(1-((cur*100.0)/self.maxWeight)/100, 4)

    def writeJSON(self, outfile=None):
        if not outfile: return

        nodes = []
        links = []

        for n in self.nodes:
            self.n2id[n] = self.nodes[n]['id']
            self.id2n[self.nodes[n]['id']] = n

            nodes.append({"name": n,
                          "index": self.nodes[n]['id'],
                          "id": self.nodes[n]['id'],
                          "edges": self.nodes[n]['edges'],
                          "version": self.nodes[n]['version'],
                          "nets": self.nodes[n]['networks'],
                          "group": 0 if self.nodes[n]['edges'] == 0 else 1})

        for en in self.edges:
            for e in self.edges[en]:
                e['frac'] = self.getFracWeight(int(e['weight']))
                e['sname'] = en
                e['tname'] = self.id2n[e['target']]

                links.append(e)

        x= json.dumps({'nodes': nodes,
                       'links': links})

        with open(outfile, "w") as ofp:
            ofp.write(x)
            ofp.close()

if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    parser.add_argument("-n", "--net", required=True, help="network name")
    parser.add_argument("-o", "--outfile", required=True, help="where to store json file")
    parser.add_argument("-f", "--foreground", help="stay in foreground and dump data periodically", action="store_true", default=False)
    parser.add_argument("-t", "--timeout", help="wait between dumps", default=30)
    parser.add_argument("-r", "--rundir", help="location of pid- and socket-files", default="/var/run")

    args = parser.parse_args()
    while True:
        try:
            tv = TincVis(net=args.net, rundir=args.rundir)
            tv.prepare()
            tv.writeJSON(outfile=args.outfile)
        except socket.error as e:
            print(e)

        if not args.foreground:
            sys.exit()
        else:
            time.sleep(args.timeout)
