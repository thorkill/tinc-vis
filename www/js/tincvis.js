
var dataURL = "data/nodes.json";
var autorefresh = true;
var refreshInterval = 60;

var nodes = null;
var edges = null;
var network = null;
var scaleEdge = true;
var refreshTimerID = null;

function loadJSON(path, success, error) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                success(JSON.parse(xhr.responseText));
            }
            else {
                error(xhr);
            }
        }
    };
    xhr.open("GET", path, true);
    xhr.send();
}

function findEdgeByHash(h, edges) {
    return edges.get({
        filter: function (item) {
            return (item._hash == h);
        }
    });
}

function componentToHex(c) {
    c = Math.round(c);
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function getColor(n) {
    n = Math.round(n);
    var R,G,B;

    R = (255 * n) / 100;
    G = (255 * (100 - n)) / 100;
    B = 0;
    return rgbToHex(R,G,B);
}

function toggleScaleEdges() {
    if (scaleEdge)
        scaleEdge=false;
    else
        scaleEdge=true;
}

function toggleAutoRefresh() {
    if (autorefresh) {
        autorefresh=false;
    } else {
        autorefresh=true;
    }

    if (autorefresh) {
        startTimer(refreshInterval, display);
    } else {
        clearInterval(refreshTimerID);
    }

}

function startTimer(duration, display) {
    var timer = duration, minutes, seconds;
    refreshTimerID = setInterval(function () {
        minutes = parseInt(timer / refreshInterval, 10);
        seconds = parseInt(timer % refreshInterval, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            timer = duration;
            refresh();
        }
    }, 1000);
}

function reDraw() {
    loadJSON(dataURL,draw);
    display = document.querySelector('#time');
    if (autorefresh == true) {
        startTimer(refreshInterval, display);
    }
}

function refresh() {
    loadJSON(dataURL,updateData);
}

function updateData(jsonData) {
    jsonData.nodes.forEach(function (n) {
        nodes.update(_createNode(n))
    });

    var _active_edges = [];

    jsonData.links.forEach(function (l) {
        _active_edges.push(l._hash);
        var _old_link = findEdgeByHash(l._hash, edges)
        if (_old_link.length == 0) {
            edges.add(_createEdge(l));
        } else {
            edges.update(_updateEdge(_old_link,l));
        }
    });

    edges.get().forEach(function(e) {
        if (_active_edges.indexOf(e._hash) == -1) {
            edges.remove(e);
        }
    });
}

function _createNode(n) {
    return {id: n.id,
            label: n.name,
            color: _getNodeColor(n),
            reachable: n.reachable,
            title: n.name + ' has ' + n.edges + ' edges.<br>Networks: ' + n.nets + '<br>Version: ' + n.version + '<br>Reachable: ' + n.reachable};
}

function _getNodeColor(n) {

    if (n.reachable == 0) {
        return "#FFFF66"
    }

    if (n.version >= 4) {
        return "#009933";
    } else {
        return "#97C2FC";
    }
}

function _updateEdge(old_edge, l) {
    old_edge[0].color = getColor(100-l.frac*100);
    old_edge[0].width = _getEdgeWidth(l);
    old_edge[0].title = _getEdgeTitle(l);
    old_edge[0].style = _getEdgeStyle(l);
    return old_edge;
}

function _getEdgeWidth(l) {
    if (scaleEdge) {
        var f = 7*l.frac;
        return (f > 7) ? 7 : f;
    }
    else
        return 7;
}

function _getEdgeTitle(l) {
    var out = l.reachable == 0 ? "unreachable : " : "";
    return out  + l.sname + " with " + l.tname + " (RT: "+l.weight/10+"ms)";
}

function _getEdgeStyle(l) {
    if (l.reachable == 0)
        return 'dash-line';
    else
        return 'line';
}

function _createEdge(l) {
    return {from: l.source,
            to: l.target,
            _hash: l._hash,
            color: getColor(100-l.frac*100),
            width: _getEdgeWidth(l),
            title: _getEdgeTitle(l),
            style: _getEdgeStyle(l)
           }
}

function draw(jsonData) {
    nodes = new vis.DataSet();
    edges = new vis.DataSet();

    jsonData.nodes.forEach(function (n) {
        nodes.add(_createNode(n))
    });

    jsonData.links.forEach(function (l) {
        edges.add(_createEdge(l));
    });

    var container = document.getElementById('mynetwork');
    var data = {
        nodes: nodes,
        edges: edges
    };
    var options = {
        nodes: {
            shape: 'dot'
        },
        edges: {
            color: '#97C2FC'
        },
        //configurePhysics:true,
        physics: {
            barnesHut: {
                gravitationalConstant: -5625,
                centralGravity: 1.3,
                damping: 0.30
            }
        }
    };
    var ids = edges.getIds();
    network = new vis.Network(container, data, options);
}
